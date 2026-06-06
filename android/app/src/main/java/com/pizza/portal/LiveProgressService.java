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

    // Actions
    public static final String ACTION_START  = "START";
    public static final String ACTION_UPDATE = "UPDATE";
    public static final String ACTION_STOP   = "STOP";

    // Static instance for safe direct manipulation from plugins & background workers
    public static LiveProgressService instance = null;

    // Task State class to handle multiple concurrent progress notifications
    public static class TaskState {
        public int id;
        public String title = "";
        public String text = "";
        public int progress = 0;
        public String segments = null;
        public String points = null;

        TaskState(int id, String title, String text, int progress, String segments, String points) {
            this.id = id;
            this.title = title != null ? title : "";
            this.text = text != null ? text : "";
            this.progress = progress;
            this.segments = segments;
            this.points = points;
        }
    }

    private final java.util.Map<Integer, TaskState> activeTasks = new java.util.concurrent.ConcurrentHashMap<>();
    private int foregroundNotificationId = -1;
    private boolean isForeground = false;

    private NotificationManager notificationManager;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannel();
        Log.d(TAG, "LiveProgressService: onCreate");
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

    public static int getNotificationId(String title, String idExtra) {
        if (idExtra != null && !idExtra.isEmpty()) {
            try {
                return Integer.parseInt(idExtra);
            } catch (NumberFormatException e) {
                return idExtra.hashCode();
            }
        }
        if (title == null) return 8888;
        if (title.contains("カタログ同期") || title.contains("Catalog Sync")) {
            return 8881;
        } else if (title.contains("タイムライン") || title.contains("Timeline") || title.contains("投稿") || title.contains("コメント") || title.contains("返信")) {
            return 8882;
        } else if (title.contains("車両") || title.contains("Vehicle")) {
            return 8883;
        } else if (title.contains("市民") || title.contains("Citizen") || title.contains("申請")) {
            return 8884;
        }
        return 8888;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String action = intent.getAction();

        if (ACTION_STOP.equals(action)) {
            String title = intent.getStringExtra("title");
            String idExtra = intent.getStringExtra("id");
            Log.d(TAG, "LiveProgressService: ACTION_STOP received. title=" + title + ", id=" + idExtra);
            if (title == null && idExtra == null) {
                stopAllTasks();
            } else {
                stopTask(title, idExtra);
            }
            return START_NOT_STICKY;
        }

        String title = intent.getStringExtra("title");
        String text = intent.getStringExtra("text");
        int progress = intent.getIntExtra("progress", 0);
        String segments = intent.getStringExtra("segments");
        String points = intent.getStringExtra("points");
        String idExtra = intent.getStringExtra("id");

        int taskId = getNotificationId(title, idExtra);

        if (ACTION_UPDATE.equals(action)) {
            Log.d(TAG, "LiveProgressService: ACTION_UPDATE received for taskId=" + taskId);
            TaskState task = activeTasks.get(taskId);
            if (task == null) {
                task = new TaskState(taskId, title, text, progress >= 0 ? progress : 0, segments, points);
                activeTasks.put(taskId, task);
            } else {
                if (title != null) task.title = title;
                if (text != null) task.text = text;
                if (progress >= 0) task.progress = progress;
                if (segments != null) task.segments = segments;
                if (points != null) task.points = points;
            }
            pushNotification(taskId);
            return START_STICKY;
        }

        // Default ACTION_START
        Log.d(TAG, "LiveProgressService: ACTION_START received for taskId=" + taskId);
        TaskState task = new TaskState(taskId, title, text, progress, segments, points);
        activeTasks.put(taskId, task);
        pushNotification(taskId);
        return START_STICKY;
    }

    private void pushNotification(int taskId) {
        TaskState task = activeTasks.get(taskId);
        if (task == null) return;

        Notification notification = buildNotification(
            task.title, task.text, task.progress, task.segments, task.points, task.id
        );

        if (!isForeground) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(
                    task.id,
                    notification,
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                );
            } else {
                startForeground(task.id, notification);
            }
            foregroundNotificationId = task.id;
            isForeground = true;
            Log.d(TAG, "startForeground with taskId=" + task.id);
        } else {
            notificationManager.notify(task.id, notification);
            Log.d(TAG, "notificationManager.notify updated taskId=" + task.id);
        }
    }

    public void stopTask(String title, String idExtra) {
        int taskId = getNotificationId(title, idExtra);
        Log.d(TAG, "stopTask: taskId=" + taskId + ", current activeTasks size=" + activeTasks.size());
        activeTasks.remove(taskId);
        notificationManager.cancel(taskId);

        if (taskId == foregroundNotificationId) {
            if (!activeTasks.isEmpty()) {
                int nextId = activeTasks.keySet().iterator().next();
                TaskState nextTask = activeTasks.get(nextId);
                Notification nextNotification = buildNotification(
                    nextTask.title, nextTask.text, nextTask.progress, nextTask.segments, nextTask.points, nextTask.id
                );
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    startForeground(
                        nextTask.id,
                        nextNotification,
                        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                    );
                } else {
                    startForeground(nextTask.id, nextNotification);
                }
                foregroundNotificationId = nextTask.id;
                Log.d(TAG, "Promoted taskId=" + nextTask.id + " to foreground service notification");
            } else {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_REMOVE);
                } else {
                    stopForeground(true);
                }
                isForeground = false;
                foregroundNotificationId = -1;
                Log.d(TAG, "No more active tasks, stopping foreground service");
                stopSelf();
            }
        } else {
            if (activeTasks.isEmpty()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_REMOVE);
                } else {
                    stopForeground(true);
                }
                isForeground = false;
                foregroundNotificationId = -1;
                Log.d(TAG, "No more active tasks, stopping foreground service");
                stopSelf();
            }
        }
    }

    public void stopAllTasks() {
        Log.d(TAG, "stopAllTasks");
        for (int taskId : activeTasks.keySet()) {
            notificationManager.cancel(taskId);
        }
        activeTasks.clear();
        if (isForeground) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
            isForeground = false;
            foregroundNotificationId = -1;
        }
        stopSelf();
    }

    private Notification buildNotification(String title, String text, int progress,
                                           String segmentsJson, String pointsJson, int taskId) {
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

        int smallIcon = android.R.drawable.ic_dialog_info;
        if (title.contains("カタログ同期") || title.contains("Catalog Sync")) {
            smallIcon = android.R.drawable.ic_popup_sync;
        } else if (title.contains("タイムライン") || title.contains("Timeline") || title.contains("投稿") || title.contains("コメント") || title.contains("返信")) {
            smallIcon = android.R.drawable.stat_sys_upload;
        }

        builder.setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(smallIcon)
            .setContentIntent(pendingIntent)
            .setCategory(Notification.CATEGORY_PROGRESS)
            .setOngoing(true);

        // Android 16 (API 36): Use ProgressStyle via reflection
        if (Build.VERSION.SDK_INT >= 36) {
            try {
                applyProgressStyle(builder, progress, segmentsJson, pointsJson, smallIcon);
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
                                    String segmentsJson, String pointsJson, int smallIcon) throws Exception {
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
                this, smallIcon
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
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "LiveProgressService: onDestroy");
        for (int taskId : activeTasks.keySet()) {
            notificationManager.cancel(taskId);
        }
        activeTasks.clear();
        if (isForeground) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
            isForeground = false;
            foregroundNotificationId = -1;
        }
        instance = null;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
