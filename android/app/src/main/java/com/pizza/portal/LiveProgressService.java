package com.pizza.portal;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

public class LiveProgressService extends Service {
    private static final String TAG = "LiveProgressService";
    private static final String CHANNEL_ID = "live_progress_channel";
    public static final int NOTIFICATION_ID = 8888;

    // Actions
    public static final String ACTION_START  = "START";
    public static final String ACTION_UPDATE = "UPDATE";
    public static final String ACTION_STOP   = "STOP";

    // Current state (retained for UPDATE so we can keep segments/points)
    private String  currentTitle    = "";
    private String  currentText     = "";
    private int     currentProgress = 0;
    private String  currentSegments = null;
    private String  currentPoints   = null;

    private NotificationManager notificationManager;

    @Override
    public void onCreate() {
        super.onCreate();
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannel();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Live Activity Progress",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Shows real-time status of ongoing activities");
            notificationManager.createNotificationChannel(channel);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String action = intent.getAction();

        // --- STOP ---
        if (ACTION_STOP.equals(action)) {
            Log.d(TAG, "LiveProgressService: STOP received");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
            stopSelf();
            return START_NOT_STICKY;
        }

        // --- UPDATE: patch only changed fields, keep the rest ---
        if (ACTION_UPDATE.equals(action)) {
            Log.d(TAG, "LiveProgressService: UPDATE received");
            String newTitle    = intent.getStringExtra("title");
            String newText     = intent.getStringExtra("text");
            int    newProgress = intent.getIntExtra("progress", currentProgress);
            // Segments/points are optional on update — keep current if not supplied
            String newSegments = intent.getStringExtra("segments");
            String newPoints   = intent.getStringExtra("points");

            if (newTitle    != null) currentTitle    = newTitle;
            if (newText     != null) currentText     = newText;
            currentProgress = newProgress;
            if (newSegments != null) currentSegments = newSegments;
            if (newPoints   != null) currentPoints   = newPoints;

            // Re-issue startForeground so notification updates without flicker
            pushNotification();
            return START_STICKY;
        }

        // --- START (default) ---
        Log.d(TAG, "LiveProgressService: START received");
        currentTitle    = intent.getStringExtra("title")    != null ? intent.getStringExtra("title")    : "";
        currentText     = intent.getStringExtra("text")     != null ? intent.getStringExtra("text")     : "";
        currentProgress = intent.getIntExtra("progress", 0);
        currentSegments = intent.getStringExtra("segments");
        currentPoints   = intent.getStringExtra("points");

        pushNotification();
        return START_STICKY;
    }

    /**
     * Build and show (or refresh) the foreground notification with current state.
     */
    private void pushNotification() {
        Notification notification = buildNotification(
            currentTitle, currentText, currentProgress, currentSegments, currentPoints
        );
        // Always use startForeground so the notification stays promoted
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private Notification buildNotification(String title, String text, int progress,
                                           String segmentsJson, String pointsJson) {
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        // Tap → open app
        Intent mainIntent = new Intent(this, MainActivity.class);
        mainIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, mainIntent, pendingFlags);

        builder.setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setCategory(Notification.CATEGORY_PROGRESS)
            .setOngoing(true);

        // Android 16 (API 36): Use ProgressStyle via reflection
        if (Build.VERSION.SDK_INT >= 36) {
            try {
                applyProgressStyle(builder, progress, segmentsJson, pointsJson);
            } catch (Throwable t) {
                Log.w(TAG, "ProgressStyle reflection failed, falling back: " + t.getMessage());
                builder.setProgress(100, progress, false);
            }
        } else {
            // API < 36: Standard indeterminate or determinate progress bar
            builder.setProgress(100, progress, false);
        }

        return builder.build();
    }

    private void applyProgressStyle(Notification.Builder builder, int progress,
                                    String segmentsJson, String pointsJson) throws Exception {
        // setRequestPromotedOngoing(true)
        java.lang.reflect.Method setPromotedMethod =
            Notification.Builder.class.getMethod("setRequestPromotedOngoing", boolean.class);
        setPromotedMethod.invoke(builder, true);

        // new Notification.ProgressStyle()
        Class<?> psClass = Class.forName("android.app.Notification$ProgressStyle");
        Object ps = psClass.getDeclaredConstructor().newInstance();

        // setStyledByProgress(true)
        psClass.getMethod("setStyledByProgress", boolean.class).invoke(ps, true);

        // setProgress(progress, 100) — try two-arg first, fall back to one-arg
        try {
            psClass.getMethod("setProgress", int.class, int.class).invoke(ps, progress, 100);
        } catch (NoSuchMethodException e2) {
            psClass.getMethod("setProgress", int.class).invoke(ps, progress);
        }

        // Segments
        if (segmentsJson != null && !segmentsJson.isEmpty()) {
            try {
                JSONArray arr = new JSONArray(segmentsJson);
                Class<?> segClass = Class.forName("android.app.Notification$ProgressStyle$Segment");
                java.lang.reflect.Constructor<?> segCtor = segClass.getConstructor(int.class);
                java.lang.reflect.Method setColor = segClass.getMethod("setColor", int.class);

                List<Object> list = new ArrayList<>();
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject o = arr.getJSONObject(i);
                    int weight = o.getInt("weight");
                    String colorStr = o.getString("color");
                    Object seg = segCtor.newInstance(weight);
                    setColor.invoke(seg, android.graphics.Color.parseColor(colorStr));
                    list.add(seg);
                }
                psClass.getMethod("setProgressSegments", java.util.List.class).invoke(ps, list);
            } catch (Exception e) {
                Log.e(TAG, "Failed to apply segments: " + e.getMessage());
            }
        }

        // Points
        if (pointsJson != null && !pointsJson.isEmpty()) {
            try {
                JSONArray arr = new JSONArray(pointsJson);
                Class<?> ptClass = Class.forName("android.app.Notification$ProgressStyle$Point");
                java.lang.reflect.Constructor<?> ptCtor = ptClass.getConstructor(int.class);
                java.lang.reflect.Method setColor = ptClass.getMethod("setColor", int.class);

                List<Object> list = new ArrayList<>();
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject o = arr.getJSONObject(i);
                    int position = o.getInt("position");
                    String colorStr = o.getString("color");
                    Object pt = ptCtor.newInstance(position);
                    setColor.invoke(pt, android.graphics.Color.parseColor(colorStr));
                    list.add(pt);
                }
                psClass.getMethod("setProgressPoints", java.util.List.class).invoke(ps, list);
            } catch (Exception e) {
                Log.e(TAG, "Failed to apply points: " + e.getMessage());
            }
        }

        // Tracker icon
        try {
            android.graphics.drawable.Icon icon = android.graphics.drawable.Icon.createWithResource(
                this, android.R.drawable.ic_dialog_info
            );
            psClass.getMethod("setTrackerIcon", android.graphics.drawable.Icon.class).invoke(ps, icon);
        } catch (Throwable t) {
            Log.w(TAG, "setTrackerIcon failed: " + t.getMessage());
        }

        // builder.setStyle(ps)
        Notification.Builder.class
            .getMethod("setStyle", Class.forName("android.app.Notification$Style"))
            .invoke(builder, ps);

        Log.d(TAG, "ProgressStyle applied: progress=" + progress);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
