package com.pizza.portal;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

public class LiveProgressService extends Service {
    private static final String TAG = "LiveProgressService";
    private static final String CHANNEL_ID = "live_progress_channel";

    // Safety cap: never keep a dataSync foreground service alive longer than 3 minutes
    // to strictly prevent Android 14/15/16 ForegroundServiceDidNotStopInTimeException.
    private static final long MAX_FOREGROUND_DURATION_MS = 3 * 60 * 1000L;

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

    private static final java.util.Map<Integer, TaskState> activeTasks = new java.util.concurrent.ConcurrentHashMap<>();
    private int foregroundNotificationId = -1;
    private boolean isForeground = false;

    private NotificationManager notificationManager;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Runnable safetyDetachRunnable = new Runnable() {
        @Override
        public void run() {
            Log.w(TAG, "Safety foreground duration reached — detaching foreground service while keeping notifications active.");
            detachForegroundAndStop();
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        ensureNotificationChannel(this);
        Log.d(TAG, "LiveProgressService: onCreate");
    }

    public static void ensureNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            NotificationChannel existing = nm.getNotificationChannel(CHANNEL_ID);
            if (existing == null) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Live Activity Progress",
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Shows real-time status of ongoing activities");
                nm.createNotificationChannel(channel);
            }
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

    /**
     * Only short-lived active upload/sync tasks (8881 Catalog Sync, 8882 Timeline Upload)
     * should use a Foreground Service. Long-lived review status trackers (8883 Vehicle,
     * 8884 Citizen Application) must be posted directly via NotificationManager so the
     * dataSync Foreground Service never stays running for hours in the background.
     */
    public static boolean isShortTermForegroundTask(int taskId) {
        return taskId == 8881 || taskId == 8882;
    }

    /**
     * Static helper to post or update a LiveProgress notification directly via NotificationManager
     * without requiring a long-running Foreground Service.
     */
    public static int postOrUpdateNotification(Context context, String title, String text, int progress,
                                               String segments, String points, String idExtra) {
        Context appContext = context.getApplicationContext();
        ensureNotificationChannel(appContext);
        NotificationManager nm = (NotificationManager) appContext.getSystemService(Context.NOTIFICATION_SERVICE);
        int taskId = getNotificationId(title, idExtra);

        TaskState task = activeTasks.get(taskId);
        if (task == null) {
            task = new TaskState(taskId, title, text, Math.max(0, progress), segments, points);
            activeTasks.put(taskId, task);
        } else {
            if (title != null) task.title = title;
            if (text != null) task.text = text;
            if (progress >= 0) task.progress = progress;
            if (segments != null) task.segments = segments;
            if (points != null) task.points = points;
        }

        Notification notification = buildNotificationStatic(
            appContext, task.title, task.text, task.progress, task.segments, task.points, task.id
        );
        if (nm != null) {
            nm.notify(task.id, notification);
        }
        return taskId;
    }

    public static void cancelTaskNotification(Context context, String title, String idExtra) {
        Context appContext = context.getApplicationContext();
        NotificationManager nm = (NotificationManager) appContext.getSystemService(Context.NOTIFICATION_SERVICE);
        int taskId = getNotificationId(title, idExtra);
        activeTasks.remove(taskId);
        if (nm != null) {
            nm.cancel(taskId);
        }
        if (instance != null) {
            instance.onTaskRemovedInternal(taskId);
        }
    }

    public static void cancelAllTaskNotifications(Context context) {
        Context appContext = context.getApplicationContext();
        NotificationManager nm = (NotificationManager) appContext.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            for (int taskId : activeTasks.keySet()) {
                nm.cancel(taskId);
            }
        }
        activeTasks.clear();
        if (instance != null) {
            instance.detachForegroundAndStop();
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            detachForegroundAndStop();
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

        int taskId = postOrUpdateNotification(this, title, text, progress, segments, points, idExtra);
        pushForegroundIfNeeded(taskId);
        return START_NOT_STICKY;
    }

    private void pushForegroundIfNeeded(int taskId) {
        TaskState task = activeTasks.get(taskId);
        if (task == null) {
            detachForegroundAndStop();
            return;
        }

        Notification notification = buildNotificationStatic(
            this, task.title, task.text, task.progress, task.segments, task.points, task.id
        );

        // Always call startForeground first in case the service was started via startForegroundService()
        try {
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
        } catch (Throwable t) {
            Log.w(TAG, "startForeground failed, falling back to NotificationManager: " + t.getMessage());
            notificationManager.notify(task.id, notification);
        }

        // If this is a passive tracker (e.g. 8883 Vehicle or 8884 Citizen Application) and no short-term
        // sync task is active, immediately detach the foreground service so it never runs in background!
        if (!hasActiveShortTermTask()) {
            Log.d(TAG, "No short-term sync task active (taskId=" + taskId + "), detaching foreground service immediately.");
            detachForegroundAndStop();
            // Re-post via NotificationManager to ensure the ongoing notification stays visible after detach
            notificationManager.notify(task.id, notification);
        } else {
            // Reset 3-minute safety timer for short-term tasks
            mainHandler.removeCallbacks(safetyDetachRunnable);
            mainHandler.postDelayed(safetyDetachRunnable, MAX_FOREGROUND_DURATION_MS);
        }
    }

    private boolean hasActiveShortTermTask() {
        for (int id : activeTasks.keySet()) {
            if (isShortTermForegroundTask(id)) {
                return true;
            }
        }
        return false;
    }

    private void onTaskRemovedInternal(int removedTaskId) {
        if (!hasActiveShortTermTask()) {
            detachForegroundAndStop();
        }
    }

    private void detachForegroundAndStop() {
        mainHandler.removeCallbacks(safetyDetachRunnable);
        if (isForeground) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_DETACH);
                } else {
                    stopForeground(false);
                }
            } catch (Throwable t) {
                Log.w(TAG, "stopForeground detach warning: " + t.getMessage());
            }
            isForeground = false;
            foregroundNotificationId = -1;
        }
        try {
            stopSelf();
        } catch (Throwable t) {
            Log.w(TAG, "stopSelf warning: " + t.getMessage());
        }
    }

    public void stopTask(String title, String idExtra) {
        cancelTaskNotification(this, title, idExtra);
    }

    public void stopAllTasks() {
        cancelAllTaskNotifications(this);
    }

    // Android 14 (API 34) Foreground Service timeout callback
    @Override
    public void onTimeout(int startId) {
        Log.w(TAG, "onTimeout(startId=" + startId + ") reached for dataSync service — stopping immediately.");
        detachForegroundAndStop();
    }

    // Android 15+ (API 35+) Foreground Service timeout callback with fgsType
    @Override
    public void onTimeout(int startId, int fgsType) {
        Log.w(TAG, "onTimeout(startId=" + startId + ", fgsType=" + fgsType + ") reached — stopping immediately.");
        detachForegroundAndStop();
    }

    private static Notification buildNotificationStatic(Context context, String title, String text, int progress,
                                                        String segmentsJson, String pointsJson, int taskId) {
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(context, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(context);
        }

        // Tap → open app
        Intent mainIntent = new Intent(context, MainActivity.class);
        mainIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, mainIntent, pendingFlags);

        int smallIcon = context.getApplicationInfo().icon;
        if (smallIcon == 0) {
            smallIcon = context.getResources().getIdentifier("ic_launcher", "mipmap", context.getPackageName());
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
                applyProgressStyleStatic(context, builder, progress, segmentsJson, pointsJson, smallIcon);
            } catch (Throwable t) {
                Log.w(TAG, "ProgressStyle reflection failed, falling back: " + t.getMessage());
                builder.setProgress(100, progress, false);
            }
        } else {
            // API < 36: Standard indeterminate or determinate progress bar
            builder.setProgress(100, progress, false);
        }

        // Xiaomi HyperOS (HyperIsland / Focus Notification) support
        HyperIslandHelper.applyLiveProgress(
            context, builder, title, text, progress, segmentsJson, pointsJson, pendingIntent
        );

        return builder.build();
    }

    private static void applyProgressStyleStatic(Context context, Notification.Builder builder, int progress,
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
                context, smallIcon
            );
            java.lang.reflect.Method setTrackerIconMethod;
            try {
                setTrackerIconMethod = psClass.getMethod("setProgressTrackerIcon", android.graphics.drawable.Icon.class);
            } catch (NoSuchMethodException e) {
                setTrackerIconMethod = psClass.getMethod("setTrackerIcon", android.graphics.drawable.Icon.class);
            }
            setTrackerIconMethod.invoke(ps, icon);
        } catch (Throwable t) {
            Log.w(TAG, "Failed to set tracker icon: " + t.getMessage());
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
        mainHandler.removeCallbacks(safetyDetachRunnable);
        if (isForeground) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_DETACH);
                } else {
                    stopForeground(false);
                }
            } catch (Throwable ignored) {}
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

