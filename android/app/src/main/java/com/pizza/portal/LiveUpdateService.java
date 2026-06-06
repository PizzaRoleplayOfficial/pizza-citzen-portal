package com.pizza.portal;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import androidx.core.content.FileProvider;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class LiveUpdateService extends Service {
    private static final String TAG = "LiveUpdateService";
    private static final String CHANNEL_ID = "live_update_channel";
    private static final int NOTIFICATION_ID = 9999;
    
    private NotificationManager notificationManager;
    private Thread downloadThread;

    @Override
    public void onCreate() {
        super.onCreate();
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String downloadUrl = intent.getStringExtra("downloadUrl");
        if (downloadUrl == null || downloadUrl.isEmpty()) {
            stopSelf();
            return START_NOT_STICKY;
        }

        // Start Foreground Service with initial notification safely on Android 14+ (UPSIDE_DOWN_CAKE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_ID, 
                buildProgressNotification(0), 
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE
            );
        } else {
            startForeground(NOTIFICATION_ID, buildProgressNotification(0));
        }

        // Start downloading in background thread
        downloadThread = new Thread(() -> {
            downloadAndInstall(downloadUrl);
        });
        downloadThread.start();

        return START_NOT_STICKY;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "App Updates",
                NotificationManager.IMPORTANCE_HIGH // Raise importance to HIGH for Xiaomi/MIUI compatibility
            );
            channel.setDescription("Shows download progress for application updates");
            notificationManager.createNotificationChannel(channel);
        }
    }

    private Notification buildProgressNotification(int progress) {
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        String contentText;
        if (progress < 75) {
            int downloadPercent = (int) (progress * 100.0 / 75.0);
            if (downloadPercent > 100) downloadPercent = 100;
            contentText = "Downloading update... " + downloadPercent + "%";
        } else {
            contentText = "Verifying & installing update...";
        }

        builder.setContentTitle("GV Portal Update")
            .setContentText(contentText)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setCategory(Notification.CATEGORY_PROGRESS) // Help OS classify it correctly for Live Update promotion
            .setOngoing(true);

        // Apply Android 16 ProgressStyle safely if supported
        if (Build.VERSION.SDK_INT >= 36) {
            try {
                Android16Helper.applyProgressStyle(builder, progress, this, notificationManager);
            } catch (Throwable t) {
                Log.e(TAG, "Failed to apply Android 16 ProgressStyle", t);
                // Fallback to standard progress bar on exception
                builder.setProgress(100, progress, false);
            }
        } else {
            // Under Android 16, set standard progress bar
            builder.setProgress(100, progress, false);
        }

        return builder.build();
    }

    private Notification buildIndeterminateNotification(int kbDownloaded) {
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        String downloadedText = String.format("Downloading... %.1f MB", kbDownloaded / 1024.0);
        builder.setContentTitle("GV Portal Update")
            .setContentText(downloadedText)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setCategory(Notification.CATEGORY_PROGRESS)
            .setOngoing(true);

        // Under Android 16, set indeterminate progress style
        if (Build.VERSION.SDK_INT >= 36) {
            try {
                Android16Helper.applyIndeterminateStyle(builder, this, notificationManager);
            } catch (Throwable t) {
                Log.e(TAG, "Failed to apply Android 16 Indeterminate Style", t);
                builder.setProgress(0, 0, true);
            }
        } else {
            builder.setProgress(0, 0, true);
        }

        return builder.build();
    }

    // Inner class helper using reflection to prevent compilation and runtime errors on environments without Android 16 SDK
    private static class Android16Helper {
        static void applyProgressStyle(Notification.Builder builder, int progress, Context context, NotificationManager notificationManager) {
            try {
                // Log promoted notification permission state on Android 16 for debugging
                try {
                    java.lang.reflect.Method canPostMethod = 
                        NotificationManager.class.getMethod("canPostPromotedNotifications");
                    boolean canPost = (boolean) canPostMethod.invoke(notificationManager);
                    Log.d(TAG, "Android 16 canPostPromotedNotifications: " + canPost);
                } catch (Throwable t) {
                    Log.w(TAG, "Failed to check canPostPromotedNotifications via reflection: " + t.getMessage());
                }

                // Call builder.setRequestPromotedOngoing(true) via reflection
                java.lang.reflect.Method setRequestPromotedOngoingMethod = 
                    Notification.Builder.class.getMethod("setRequestPromotedOngoing", boolean.class);
                setRequestPromotedOngoingMethod.invoke(builder, true);

                // Instantiate and configure Notification.ProgressStyle via reflection
                Class<?> progressStyleClass = Class.forName("android.app.Notification$ProgressStyle");
                Object progressStyle = progressStyleClass.getDeclaredConstructor().newInstance();

                java.lang.reflect.Method setStyledByProgressMethod = 
                    progressStyleClass.getMethod("setStyledByProgress", boolean.class);
                setStyledByProgressMethod.invoke(progressStyle, true);

                // Set progress inside ProgressStyle
                try {
                    java.lang.reflect.Method setProgressMethod = 
                        progressStyleClass.getMethod("setProgress", int.class, int.class);
                    setProgressMethod.invoke(progressStyle, progress, 100);
                } catch (NoSuchMethodException e) {
                    java.lang.reflect.Method setProgressMethod = 
                        progressStyleClass.getMethod("setProgress", int.class);
                    setProgressMethod.invoke(progressStyle, progress);
                }

                // Set segments and points inside ProgressStyle via reflection
                try {
                    Class<?> segmentClass = Class.forName("android.app.Notification$ProgressStyle$Segment");
                    java.lang.reflect.Constructor<?> segmentConstructor = segmentClass.getConstructor(int.class);
                    java.lang.reflect.Method setSegmentColorMethod = segmentClass.getMethod("setColor", int.class);

                    Object dlSegment = segmentConstructor.newInstance(75);
                    setSegmentColorMethod.invoke(dlSegment, android.graphics.Color.parseColor("#00C166"));

                    Object instSegment = segmentConstructor.newInstance(25);
                    setSegmentColorMethod.invoke(instSegment, android.graphics.Color.parseColor("#FF9800"));

                    java.util.List<Object> segmentsList = new java.util.ArrayList<>();
                    segmentsList.add(dlSegment);
                    segmentsList.add(instSegment);

                    java.lang.reflect.Method setProgressSegmentsMethod = 
                        progressStyleClass.getMethod("setProgressSegments", java.util.List.class);
                    setProgressSegmentsMethod.invoke(progressStyle, segmentsList);

                    Class<?> pointClass = Class.forName("android.app.Notification$ProgressStyle$Point");
                    java.lang.reflect.Constructor<?> pointConstructor = pointClass.getConstructor(int.class);
                    java.lang.reflect.Method setPointColorMethod = pointClass.getMethod("setColor", int.class);

                    Object dlCompletePoint = pointConstructor.newInstance(75);
                    setPointColorMethod.invoke(dlCompletePoint, android.graphics.Color.parseColor("#00C166"));

                    Object installPoint = pointConstructor.newInstance(100);
                    setPointColorMethod.invoke(installPoint, android.graphics.Color.parseColor("#FF9800"));

                    java.util.List<Object> pointsList = new java.util.ArrayList<>();
                    pointsList.add(dlCompletePoint);
                    pointsList.add(installPoint);

                    java.lang.reflect.Method setProgressPointsMethod = 
                        progressStyleClass.getMethod("setProgressPoints", java.util.List.class);
                    setProgressPointsMethod.invoke(progressStyle, pointsList);
                } catch (Throwable t) {
                    Log.w(TAG, "Failed to apply segments/points to LiveUpdate ProgressStyle: " + t.getMessage());
                }

                // Set tracker icon inside ProgressStyle
                try {
                    android.graphics.drawable.Icon trackerIcon = 
                        android.graphics.drawable.Icon.createWithResource(
                            context,
                            android.R.drawable.stat_sys_download
                        );
                    java.lang.reflect.Method setTrackerIconMethod = 
                        progressStyleClass.getMethod("setTrackerIcon", android.graphics.drawable.Icon.class);
                    setTrackerIconMethod.invoke(progressStyle, trackerIcon);
                } catch (Throwable t) {
                    Log.w(TAG, "Failed to set tracker icon", t);
                }

                // Call builder.setStyle(progressStyle) via reflection
                java.lang.reflect.Method setStyleMethod = 
                    Notification.Builder.class.getMethod("setStyle", Class.forName("android.app.Notification$Style"));
                setStyleMethod.invoke(builder, progressStyle);

                Log.d(TAG, "Successfully applied Android 16 ProgressStyle and RequestPromotedOngoing via reflection");
            } catch (Throwable t) {
                Log.w(TAG, "Android 16 Live Updates API is not available on this device or SDK: " + t.getMessage());
            }
        }

        static void applyIndeterminateStyle(Notification.Builder builder, Context context, NotificationManager notificationManager) {
            try {
                // Call builder.setRequestPromotedOngoing(true) via reflection
                java.lang.reflect.Method setRequestPromotedOngoingMethod = 
                    Notification.Builder.class.getMethod("setRequestPromotedOngoing", boolean.class);
                setRequestPromotedOngoingMethod.invoke(builder, true);

                // Instantiate and configure Notification.ProgressStyle via reflection
                Class<?> progressStyleClass = Class.forName("android.app.Notification$ProgressStyle");
                Object progressStyle = progressStyleClass.getDeclaredConstructor().newInstance();

                java.lang.reflect.Method setStyledByProgressMethod = 
                    progressStyleClass.getMethod("setStyledByProgress", boolean.class);
                setStyledByProgressMethod.invoke(progressStyle, true);

                // Call builder.setStyle(progressStyle) via reflection
                java.lang.reflect.Method setStyleMethod = 
                    Notification.Builder.class.getMethod("setStyle", Class.forName("android.app.Notification$Style"));
                setStyleMethod.invoke(builder, progressStyle);

                builder.setProgress(0, 0, true);
                Log.d(TAG, "Successfully applied Android 16 Indeterminate ProgressStyle and RequestPromotedOngoing via reflection");
            } catch (Throwable t) {
                Log.w(TAG, "Android 16 Indeterminate Live Updates API is not available: " + t.getMessage());
                builder.setProgress(0, 0, true);
            }
        }
    }

    private void downloadAndInstall(String urlString) {
        if ("test".equalsIgnoreCase(urlString) || "debug".equalsIgnoreCase(urlString)) {
            runTestDemo();
            return;
        }

        File apkFile = new File(getExternalFilesDir(null), "pizza_update.apk");
        if (apkFile.exists()) {
            apkFile.delete();
        }

        HttpURLConnection connection = null;
        InputStream input = null;
        FileOutputStream output = null;

        try {
            URL url = new URL(urlString);
            int redirectCount = 0;
            int status = -1;

            while (true) {
                connection = (HttpURLConnection) url.openConnection();
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36");
                connection.setRequestProperty("Accept", "*/*");
                connection.connect();

                status = connection.getResponseCode();
                if (status == HttpURLConnection.HTTP_MOVED_TEMP || 
                    status == HttpURLConnection.HTTP_MOVED_PERM || 
                    status == 307 || status == 308) {
                    
                    if (redirectCount > 8) {
                        throw new Exception("Too many redirects");
                    }
                    String newUrl = connection.getHeaderField("Location");
                    connection.disconnect();
                    url = new URL(newUrl);
                    redirectCount++;
                } else {
                    break;
                }
            }

            if (status != HttpURLConnection.HTTP_OK) {
                throw new Exception("Server returned HTTP " + status);
            }

            int fileLength = connection.getContentLength();
            input = new BufferedInputStream(connection.getInputStream());
            output = new FileOutputStream(apkFile);

            byte[] data = new byte[4096];
            long total = 0;
            int count;
            int lastProgress = -1;

            while ((count = input.read(data)) != -1) {
                total += count;
                output.write(data, 0, count);

                if (fileLength > 0) {
                    int progress = (int) (total * 74.0 / fileLength);
                    if (progress != lastProgress) {
                        lastProgress = progress;
                        notificationManager.notify(NOTIFICATION_ID, buildProgressNotification(progress));
                    }
                } else {
                    int kbDownloaded = (int) (total / 1024);
                    int currentMarker = kbDownloaded / 512; // Update every 512KB
                    if (currentMarker != lastProgress) {
                        lastProgress = currentMarker;
                        notificationManager.notify(NOTIFICATION_ID, buildIndeterminateNotification(kbDownloaded));
                    }
                }
            }

            output.flush();
            output.close();
            input.close();

            // Notify transition to verification & installing phase (100% / second segment)
            notificationManager.notify(NOTIFICATION_ID, buildProgressNotification(100));
            try {
                Thread.sleep(800); // Small pause for user feedback of transition
            } catch (Exception ignored) {}

            // Download finished, launch installer
            triggerApkInstall(apkFile);

        } catch (Exception e) {
            Log.e(TAG, "Download failed", e);
            showErrorNotification(e.getMessage());
        } finally {
            try {
                if (output != null) output.close();
                if (input != null) input.close();
            } catch (Exception ignored) {}
            if (connection != null) connection.disconnect();
            stopSelf();
        }
    }

    private void showErrorNotification(String errorMsg) {
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        builder.setContentTitle("Update Failed")
            .setContentText(errorMsg != null ? errorMsg : "Failed to download update")
            .setSmallIcon(android.R.drawable.stat_notify_error)
            .setAutoCancel(true);

        notificationManager.notify(NOTIFICATION_ID + 1, builder.build());
    }

    private void triggerApkInstall(File file) {
        try {
            // Dismiss ongoing notification
            notificationManager.cancel(NOTIFICATION_ID);

            Intent intent = new Intent(Intent.ACTION_VIEW);
            Uri apkUri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                apkUri = FileProvider.getUriForFile(
                    this,
                    getPackageName() + ".fileprovider",
                    file
                );
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                grantUriPermission("com.google.android.packageinstaller", apkUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                grantUriPermission("com.android.packageinstaller", apkUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } else {
                apkUri = Uri.fromFile(file);
            }

            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start installation", e);
            showErrorNotification(e.getMessage());
        }
    }

    private void runTestDemo() {
        try {
            int progress = 0;
            while (progress <= 100) {
                notificationManager.notify(NOTIFICATION_ID, buildProgressNotification(progress));
                Thread.sleep(500); // 0.5s interval
                progress += 10;
            }
            // Success Notification Demo
            Notification.Builder builder;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                builder = new Notification.Builder(this, CHANNEL_ID);
            } else {
                builder = new Notification.Builder(this);
            }
            builder.setContentTitle("GV Portal Update Test")
                .setContentText("Test update download completed successfully!")
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setAutoCancel(true);
            notificationManager.notify(NOTIFICATION_ID + 2, builder.build());
        } catch (InterruptedException e) {
            Log.d(TAG, "Test demo interrupted");
        } finally {
            notificationManager.cancel(NOTIFICATION_ID);
            stopSelf();
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (downloadThread != null && downloadThread.isAlive()) {
            downloadThread.interrupt();
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
