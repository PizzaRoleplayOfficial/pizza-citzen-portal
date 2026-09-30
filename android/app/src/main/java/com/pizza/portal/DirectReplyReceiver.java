package com.pizza.portal;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;
import androidx.core.app.RemoteInput;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;

public class DirectReplyReceiver extends BroadcastReceiver {

    private static final String TAG = "DirectReplyReceiver";

    public static final String ACTION_DIRECT_REPLY = "com.pizza.portal.ACTION_DIRECT_REPLY";
    public static final String ACTION_MARK_READ = "com.pizza.portal.ACTION_MARK_READ";

    public static final String KEY_TEXT_REPLY = "key_text_reply";
    public static final String EXTRA_CONVERSATION_ID = "extra_conversation_id";
    public static final String EXTRA_PARTNER_ID = "extra_partner_id";
    public static final String EXTRA_PARTNER_NAME = "extra_partner_name";
    public static final String EXTRA_RECIPIENT_ID = "extra_recipient_id";
    public static final String EXTRA_NOTIFICATION_ID = "extra_notification_id";
    public static final String EXTRA_LAST_BODY = "extra_last_body";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Log.d(TAG, "onReceive action: " + action);

        final String conversationId = intent.getStringExtra(EXTRA_CONVERSATION_ID);
        final String partnerId = intent.getStringExtra(EXTRA_PARTNER_ID);
        final String partnerName = intent.getStringExtra(EXTRA_PARTNER_NAME);
        final String recipientIdExtra = intent.getStringExtra(EXTRA_RECIPIENT_ID);
        final int notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, 0);
        final String lastBody = intent.getStringExtra(EXTRA_LAST_BODY);

        SharedPreferences prefs = context.getSharedPreferences("BackgroundPollPrefs", Context.MODE_PRIVATE);
        String savedUserId = prefs.getString("userId", null);
        final String userId = (savedUserId != null && !savedUserId.isEmpty()) ? savedUserId : recipientIdExtra;
        final String domain = prefs.getString("domain", "https://pizza-citizen-portal.pages.dev");

        if (userId == null || userId.isEmpty()) {
            Log.e(TAG, "No userId available to perform background notification action");
            return;
        }

        // 1. ACTION: MARK AS READ (既読にする)
        if (ACTION_MARK_READ.equals(action)) {
            Log.d(TAG, "Handling mark_read for conv: " + conversationId);
            // Cancel notification immediately
            try {
                NotificationManagerCompat.from(context).cancel(notificationId);
            } catch (Exception e) {
                Log.w(TAG, "Failed to cancel notification: " + e.getMessage());
            }

            Executors.newSingleThreadExecutor().execute(() -> {
                try {
                    JSONObject payload = new JSONObject();
                    payload.put("action", "mark_read");
                    payload.put("senderId", userId);
                    payload.put("conversationId", conversationId);
                    int code = postJson(domain + "/api/dm", payload.toString());
                    Log.d(TAG, "Mark read post response: " + code);
                } catch (Exception e) {
                    Log.e(TAG, "Failed to mark read on server: " + e.getMessage(), e);
                }
            });
            return;
        }

        // 2. ACTION: DIRECT REPLY (インライン返信)
        if (ACTION_DIRECT_REPLY.equals(action)) {
            Bundle remoteInput = RemoteInput.getResultsFromIntent(intent);
            if (remoteInput == null) {
                Log.w(TAG, "RemoteInput results are null");
                return;
            }

            CharSequence replyCharSequence = remoteInput.getCharSequence(KEY_TEXT_REPLY);
            if (replyCharSequence == null) return;
            final String replyText = replyCharSequence.toString().trim();
            if (replyText.isEmpty()) return;

            Log.d(TAG, "Direct reply text: " + replyText);

            // Update notification immediately to reflect sent message (Discord-like UX)
            Person userPerson = new Person.Builder().setName("あなた").build();
            Person partnerPerson = new Person.Builder().setName(partnerName != null ? partnerName : "相手").build();

            NotificationCompat.MessagingStyle updatedStyle = new NotificationCompat.MessagingStyle(userPerson)
                    .setConversationTitle(null)
                    .setGroupConversation(false);

            if (lastBody != null && !lastBody.isEmpty()) {
                String[] lines = lastBody.split("\n");
                for (int i = 0; i < lines.length; i++) {
                    String line = lines[i].trim();
                    if (!line.isEmpty()) {
                        updatedStyle.addMessage(line, System.currentTimeMillis() - 2000L, partnerPerson);
                    }
                }
            }
            updatedStyle.addMessage(replyText, System.currentTimeMillis(), userPerson);

            NotificationCompat.Builder updatedBuilder = new NotificationCompat.Builder(context, PortalFirebaseMessagingService.CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setStyle(updatedStyle)
                    .setContentText("送信しました")
                    .setAutoCancel(true)
                    .setTimeoutAfter(3500); // Automatically dismiss after 3.5 seconds

            try {
                NotificationManagerCompat.from(context).notify(notificationId, updatedBuilder.build());
            } catch (Exception e) {
                Log.w(TAG, "Failed to update notification with sent message: " + e.getMessage());
            }

            // Post message in background
            Executors.newSingleThreadExecutor().execute(() -> {
                try {
                    JSONObject payload = new JSONObject();
                    payload.put("action", "send");
                    payload.put("senderId", userId);
                    payload.put("recipientId", partnerId);
                    payload.put("conversationId", conversationId);
                    payload.put("content", replyText);

                    int code = postJson(domain + "/api/dm", payload.toString());
                    Log.d(TAG, "Direct reply post result code: " + code);
                } catch (Exception e) {
                    Log.e(TAG, "Failed to send direct reply to server: " + e.getMessage(), e);
                }
            });
        }
    }

    private int postJson(String endpoint, String jsonString) throws Exception {
        URL url = new URL(endpoint);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
        conn.setRequestProperty("Accept", "application/json");
        conn.setConnectTimeout(6000);
        conn.setReadTimeout(6000);
        conn.setDoOutput(true);

        try (OutputStream os = conn.getOutputStream()) {
            os.write(jsonString.getBytes(StandardCharsets.UTF_8));
            os.flush();
        }

        int code = conn.getResponseCode();
        conn.disconnect();
        return code;
    }
}
