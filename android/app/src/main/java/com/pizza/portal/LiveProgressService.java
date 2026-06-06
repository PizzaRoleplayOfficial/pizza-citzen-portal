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
    private static final int NOTIFICATION_ID = 8888;
    
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
        if ("STOP".equals(action)) {
            Log.d(TAG, "Stopping LiveProgress service foreground...");
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        String title = intent.getStringExtra("title");
        String text = intent.getStringExtra("text");
        int progress = intent.getIntExtra("progress", 0);
        String segmentsJson = intent.getStringExtra("segments");
        String pointsJson = intent.getStringExtra("points");

        Notification notification = buildNotification(title, text, progress, segmentsJson, pointsJson);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_ID, 
                notification, 
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        return START_STICKY;
    }

    private Notification buildNotification(String title, String text, int progress, String segmentsJson, String pointsJson) {
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        Intent mainIntent = new Intent(this, MainActivity.class);
        mainIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
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

        if (Build.VERSION.SDK_INT >= 36) {
            try {
                // Request promoted ongoing
                java.lang.reflect.Method setRequestPromotedOngoingMethod = 
                    Notification.Builder.class.getMethod("setRequestPromotedOngoing", boolean.class);
                setRequestPromotedOngoingMethod.invoke(builder, true);

                // ProgressStyle instance
                Class<?> progressStyleClass = Class.forName("android.app.Notification$ProgressStyle");
                Object progressStyle = progressStyleClass.getDeclaredConstructor().newInstance();

                java.lang.reflect.Method setStyledByProgressMethod = 
                    progressStyleClass.getMethod("setStyledByProgress", boolean.class);
                setStyledByProgressMethod.invoke(progressStyle, true);

                // Set progress
                try {
                    java.lang.reflect.Method setProgressMethod = 
                        progressStyleClass.getMethod("setProgress", int.class, int.class);
                    setProgressMethod.invoke(progressStyle, progress, 100);
                } catch (NoSuchMethodException e) {
                    java.lang.reflect.Method setProgressMethod = 
                        progressStyleClass.getMethod("setProgress", int.class);
                    setProgressMethod.invoke(progressStyle, progress);
                }

                // Segments
                if (segmentsJson != null && !segmentsJson.isEmpty()) {
                    try {
                        JSONArray array = new JSONArray(segmentsJson);
                        Class<?> segmentClass = Class.forName("android.app.Notification$ProgressStyle$Segment");
                        java.lang.reflect.Constructor<?> segmentConstructor = segmentClass.getConstructor(int.class);
                        java.lang.reflect.Method setSegmentColorMethod = segmentClass.getMethod("setColor", int.class);

                        List<Object> segmentsList = new ArrayList<>();
                        for (int i = 0; i < array.length(); i++) {
                            JSONObject obj = array.getJSONObject(i);
                            int weight = obj.getInt("weight");
                            String colorStr = obj.getString("color");
                            Object segment = segmentConstructor.newInstance(weight);
                            setSegmentColorMethod.invoke(segment, android.graphics.Color.parseColor(colorStr));
                            segmentsList.add(segment);
                        }

                        java.lang.reflect.Method setProgressSegmentsMethod = 
                            progressStyleClass.getMethod("setProgressSegments", java.util.List.class);
                        setProgressSegmentsMethod.invoke(progressStyle, segmentsList);
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to parse or apply segments", e);
                    }
                }

                // Points
                if (pointsJson != null && !pointsJson.isEmpty()) {
                    try {
                        JSONArray array = new JSONArray(pointsJson);
                        Class<?> pointClass = Class.forName("android.app.Notification$ProgressStyle$Point");
                        java.lang.reflect.Constructor<?> pointConstructor = pointClass.getConstructor(int.class);
                        java.lang.reflect.Method setPointColorMethod = pointClass.getMethod("setColor", int.class);

                        List<Object> pointsList = new ArrayList<>();
                        for (int i = 0; i < array.length(); i++) {
                            JSONObject obj = array.getJSONObject(i);
                            int position = obj.getInt("position");
                            String colorStr = obj.getString("color");
                            Object point = pointConstructor.newInstance(position);
                            setPointColorMethod.invoke(point, android.graphics.Color.parseColor(colorStr));
                            pointsList.add(point);
                        }

                        java.lang.reflect.Method setProgressPointsMethod = 
                            progressStyleClass.getMethod("setProgressPoints", java.util.List.class);
                        setProgressPointsMethod.invoke(progressStyle, pointsList);
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to parse or apply points", e);
                    }
                }

                // Set tracker icon inside ProgressStyle
                try {
                    android.graphics.drawable.Icon trackerIcon = 
                        android.graphics.drawable.Icon.createWithResource(
                            this,
                            android.R.drawable.ic_dialog_info
                        );
                    java.lang.reflect.Method setTrackerIconMethod = 
                        progressStyleClass.getMethod("setTrackerIcon", android.graphics.drawable.Icon.class);
                    setTrackerIconMethod.invoke(progressStyle, trackerIcon);
                } catch (Throwable t) {
                    Log.w(TAG, "Failed to set tracker icon", t);
                }

                // Apply style
                java.lang.reflect.Method setStyleMethod = 
                    Notification.Builder.class.getMethod("setStyle", Class.forName("android.app.Notification$Style"));
                setStyleMethod.invoke(builder, progressStyle);

            } catch (Exception e) {
                Log.w(TAG, "ProgressStyle reflection failed, falling back to standard progress", e);
                builder.setProgress(100, progress, false);
            }
        } else {
            builder.setProgress(100, progress, false);
        }

        return builder.build();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
