package com.pizza.portal;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.graphics.RectF;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;
import androidx.core.app.RemoteInput;
import androidx.core.graphics.drawable.IconCompat;

import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;

public class PortalFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "PortalFCM";
    public static final String CHANNEL_ID = "dm_messages_channel";

    private static volatile boolean isAppForeground = false;
    private static volatile String activeConversationId = null;

    public static void setAppForeground(boolean foreground) {
        isAppForeground = foreground;
        Log.d(TAG, "isAppForeground set to: " + foreground);
    }

    public static void setActiveConversationId(String convId) {
        activeConversationId = convId;
        Log.d(TAG, "activeConversationId set to: " + convId);
    }

    public static String getActiveConversationId() {
        return activeConversationId;
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.d(TAG, "onMessageReceived from: " + remoteMessage.getFrom());

        Map<String, String> data = remoteMessage.getData();
        if (data != null && isDmNotification(data)) {
            String convId = data.getOrDefault("conversationId", "");
            boolean isViewingThisDm = isAppForeground && activeConversationId != null && !activeConversationId.isEmpty() && activeConversationId.equals(convId);

            if (isViewingThisDm) {
                Log.d(TAG, "User is actively viewing conversation " + convId + " in foreground. Suppressing notification shade popup.");
            } else {
                Log.d(TAG, "Showing DM rich notification with Direct Reply & MessagingStyle (active=" + activeConversationId + ", fg=" + isAppForeground + ")");
                showDmRichNotification(data);
            }

            // Always forward to Capacitor plugin so foreground web app can update immediately
            try {
                PushNotificationsPlugin.sendRemoteMessage(remoteMessage);
            } catch (Exception e) {
                Log.e(TAG, "Failed to sendRemoteMessage to PushNotificationsPlugin", e);
            }
        } else {
            // Forward non-DM notifications to Capacitor plugin
            Log.d(TAG, "Forwarding non-DM notification to Capacitor plugin");
            PushNotificationsPlugin.sendRemoteMessage(remoteMessage);
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "Refreshed FCM token: " + token);
        PushNotificationsPlugin.onNewToken(token);
    }

    private boolean isDmNotification(Map<String, String> data) {
        if ("dm_messages_channel".equals(data.get("channelId"))) return true;
        if ("dm_message".equals(data.get("type")) || "dm".equals(data.get("type"))) return true;
        if (data.containsKey("conversationId")) return true;
        return false;
    }

    private void showDmRichNotification(Map<String, String> data) {
        Context context = getApplicationContext();
        ensureDmNotificationChannel(context);

        String conversationId = data.getOrDefault("conversationId", "");
        String partnerId = data.getOrDefault("partnerId", "");
        String partnerName = data.getOrDefault("senderUsername", "ユーザー");
        String partnerAvatar = data.getOrDefault("senderAvatar", "");
        String recipientId = data.getOrDefault("recipientId", "");
        String title = data.getOrDefault("title", partnerName + "さんからのメッセージ");
        String body = data.getOrDefault("body", "");
        String messagesJson = data.get("messagesJson");

        int notificationId = conversationId.isEmpty() ? (int) System.currentTimeMillis() : Math.abs(conversationId.hashCode());

        // 1. Download partner avatar circular bitmap
        Bitmap avatarBitmap = null;
        if (partnerAvatar != null && !partnerAvatar.isEmpty() && partnerAvatar.startsWith("http")) {
            avatarBitmap = downloadBitmapWithTimeout(partnerAvatar, 2500);
        }
        if (avatarBitmap != null) {
            avatarBitmap = getCircularBitmap(avatarBitmap);
        }

        // 2. Build Person for sender & user
        Person.Builder partnerPersonBuilder = new Person.Builder()
                .setName(partnerName)
                .setKey(partnerId.isEmpty() ? partnerName : partnerId);
        if (avatarBitmap != null) {
            partnerPersonBuilder.setIcon(IconCompat.createWithBitmap(avatarBitmap));
        }
        Person partnerPerson = partnerPersonBuilder.build();

        Person userPerson = new Person.Builder()
                .setName("あなた")
                .setKey("me")
                .build();

        // 3. Build MessagingStyle (Discord-like conversation bubbles)
        NotificationCompat.MessagingStyle messagingStyle = new NotificationCompat.MessagingStyle(userPerson)
                .setConversationTitle(null)
                .setGroupConversation(false);

        boolean addedFromMessages = false;
        if (messagesJson != null && !messagesJson.isEmpty()) {
            try {
                JSONArray arr = new JSONArray(messagesJson);
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject item = arr.getJSONObject(i);
                    String text = item.optString("text", "");
                    if (!text.isEmpty()) {
                        long timeOffset = (arr.length() - 1 - i) * 2000L;
                        messagingStyle.addMessage(text, System.currentTimeMillis() - timeOffset, partnerPerson);
                        addedFromMessages = true;
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "Failed to parse messagesJson: " + e.getMessage());
            }
        }

        if (!addedFromMessages) {
            if (body != null && !body.isEmpty()) {
                String[] lines = body.split("\n");
                for (int i = 0; i < lines.length; i++) {
                    String line = lines[i].trim();
                    if (!line.isEmpty()) {
                        long timeOffset = (lines.length - 1 - i) * 1000L;
                        messagingStyle.addMessage(line, System.currentTimeMillis() - timeOffset, partnerPerson);
                    }
                }
            } else {
                messagingStyle.addMessage("新しいメッセージがあります", System.currentTimeMillis(), partnerPerson);
            }
        }

        // 4. Content Intent (Tap on notification -> open conversation in app)
        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setAction(Intent.ACTION_VIEW);
        openIntent.setData(Uri.parse("pizzaportal://dm?conversationId=" + conversationId + "&partnerId=" + partnerId));
        openIntent.putExtra("action", "dm");
        openIntent.putExtra("conversationId", conversationId);
        openIntent.putExtra("partnerId", partnerId);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent contentPendingIntent = PendingIntent.getActivity(context, notificationId, openIntent, flags);

        // 5. Action: Mark as Read (既読にする)
        Intent markReadIntent = new Intent(context, DirectReplyReceiver.class);
        markReadIntent.setAction(DirectReplyReceiver.ACTION_MARK_READ);
        markReadIntent.putExtra(DirectReplyReceiver.EXTRA_CONVERSATION_ID, conversationId);
        markReadIntent.putExtra(DirectReplyReceiver.EXTRA_PARTNER_ID, partnerId);
        markReadIntent.putExtra(DirectReplyReceiver.EXTRA_RECIPIENT_ID, recipientId);
        markReadIntent.putExtra(DirectReplyReceiver.EXTRA_NOTIFICATION_ID, notificationId);

        PendingIntent markReadPendingIntent = PendingIntent.getBroadcast(
                context,
                notificationId * 10 + 1,
                markReadIntent,
                flags
        );
        NotificationCompat.Action markReadAction = new NotificationCompat.Action.Builder(
                0,
                "既読にする",
                markReadPendingIntent
        ).build();

        // 6. Action: Direct Reply (返信)
        RemoteInput remoteInput = new RemoteInput.Builder(DirectReplyReceiver.KEY_TEXT_REPLY)
                .setLabel(partnerName + "へ返信...")
                .build();

        Intent replyIntent = new Intent(context, DirectReplyReceiver.class);
        replyIntent.setAction(DirectReplyReceiver.ACTION_DIRECT_REPLY);
        replyIntent.putExtra(DirectReplyReceiver.EXTRA_CONVERSATION_ID, conversationId);
        replyIntent.putExtra(DirectReplyReceiver.EXTRA_PARTNER_ID, partnerId);
        replyIntent.putExtra(DirectReplyReceiver.EXTRA_PARTNER_NAME, partnerName);
        replyIntent.putExtra(DirectReplyReceiver.EXTRA_RECIPIENT_ID, recipientId);
        replyIntent.putExtra(DirectReplyReceiver.EXTRA_NOTIFICATION_ID, notificationId);
        replyIntent.putExtra(DirectReplyReceiver.EXTRA_LAST_BODY, body);

        int replyFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            replyFlags |= PendingIntent.FLAG_MUTABLE;
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            replyFlags |= PendingIntent.FLAG_UPDATE_CURRENT;
        }

        PendingIntent replyPendingIntent = PendingIntent.getBroadcast(
                context,
                notificationId * 10 + 2,
                replyIntent,
                replyFlags
        );

        NotificationCompat.Action replyAction = new NotificationCompat.Action.Builder(
                0,
                "返信",
                replyPendingIntent
        ).addRemoteInput(remoteInput)
         .setAllowGeneratedReplies(true)
         .build();

        // 7. Assemble Notification
        int smallIcon = R.mipmap.ic_launcher;
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(smallIcon)
                .setStyle(messagingStyle)
                .setContentTitle(title)
                .setContentIntent(contentPendingIntent)
                .addAction(markReadAction)
                .addAction(replyAction)
                .setAutoCancel(true)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setShowWhen(true);

        if (avatarBitmap != null) {
            builder.setLargeIcon(avatarBitmap);
        }

        try {
            NotificationManagerCompat.from(context).notify(notificationId, builder.build());
            Log.d(TAG, "DM rich notification posted successfully for conv: " + conversationId);
        } catch (SecurityException se) {
            Log.e(TAG, "Notification permission missing: " + se.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "Failed to post notification: " + e.getMessage(), e);
        }
    }

    public static void ensureDmNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                NotificationChannel channel = notificationManager.getNotificationChannel(CHANNEL_ID);
                if (channel == null) {
                    channel = new NotificationChannel(
                            CHANNEL_ID,
                            "ダイレクトメッセージ",
                            NotificationManager.IMPORTANCE_HIGH
                    );
                    channel.setDescription("DM・個別メッセージの受信通知");
                    channel.enableVibration(true);
                    channel.setShowBadge(true);
                    channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
                    notificationManager.createNotificationChannel(channel);
                }
            }
        }
    }

    private Bitmap downloadBitmapWithTimeout(String urlStr, int timeoutMs) {
        try {
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(timeoutMs);
            conn.setReadTimeout(timeoutMs);
            conn.setDoInput(true);
            conn.connect();
            InputStream is = conn.getInputStream();
            Bitmap bmp = BitmapFactory.decodeStream(is);
            is.close();
            conn.disconnect();
            return bmp;
        } catch (Exception e) {
            Log.w(TAG, "Failed to download avatar bitmap: " + e.getMessage());
            return null;
        }
    }

    public static Bitmap getCircularBitmap(Bitmap bitmap) {
        if (bitmap == null) return null;
        try {
            int size = Math.min(bitmap.getWidth(), bitmap.getHeight());
            Bitmap output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(output);
            final Paint paint = new Paint();
            final Rect rect = new Rect(0, 0, size, size);
            final RectF rectF = new RectF(rect);
            paint.setAntiAlias(true);
            canvas.drawARGB(0, 0, 0, 0);
            canvas.drawOval(rectF, paint);
            paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
            canvas.drawBitmap(bitmap, null, rect, paint);
            return output;
        } catch (Exception e) {
            return bitmap;
        }
    }
}
