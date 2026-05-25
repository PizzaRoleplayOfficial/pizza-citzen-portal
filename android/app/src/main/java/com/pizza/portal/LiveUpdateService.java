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
                NotificationManager.IMPORTANCE_LOW
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

        builder.setContentTitle("GV Portal Update")
            .setContentText("Downloading update... " + progress + "%")
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setOngoing(true);

        // Apply Android 16 ProgressStyle safely if supported
        if (Build.VERSION.SDK_INT >= 36) {
            try {
                Android16Helper.applyProgressStyle(builder, progress, this);
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

    // Inner class helper using reflection to prevent compilation and runtime errors on environments without Android 16 SDK
    private static class Android16Helper {
        static void applyProgressStyle(Notification.Builder builder, int progress, Context context) {
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
            connection = (HttpURLConnection) url.openConnection();
            connection.connect();

            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                throw new Exception("Server returned HTTP " + connection.getResponseCode());
            }

            int fileLength = connection.getContentLength();
            input = new BufferedInputStream(connection.getInputStream());
            output = new FileOutputStream(apkFile);

            byte[] data = new byte[4096];
            long total = 0;
            int count;
            int lastProgress = 0;

            while ((count = input.read(data)) != -1) {
                total += count;
                output.write(data, 0, count);

                if (fileLength > 0) {
                    int progress = (int) (total * 100 / fileLength);
                    if (progress != lastProgress) {
                        lastProgress = progress;
                        notificationManager.notify(NOTIFICATION_ID, buildProgressNotification(progress));
                    }
                }
            }

            output.flush();
            output.close();
            input.close();

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
