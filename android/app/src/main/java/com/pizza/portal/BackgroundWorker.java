package com.pizza.portal;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

public class BackgroundWorker extends Worker {
    private static final String TAG = "BackgroundWorker";
    private static final String PREFS_NAME = "BackgroundPollPrefs";
    
    public BackgroundWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Log.d(TAG, "Background polling worker started...");
        
        Context context = getApplicationContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        
        String userId = prefs.getString("userId", null);
        String role = prefs.getString("role", "user");
        String domain = prefs.getString("domain", null);
        String cachedVehiclesJson = prefs.getString("cachedVehicles", "{}");

        if (userId == null || domain == null) {
            Log.w(TAG, "Aborting poll: userId or domain is missing.");
            return Result.success();
        }

        // URLを組み立てる
        String endpoint;
        if ("admin".equals(role)) {
            endpoint = domain + "/api/vehicles?admin=true";
        } else {
            endpoint = domain + "/api/vehicles?userId=" + userId;
        }

        Log.d(TAG, "Requesting endpoint: " + endpoint);
        String response = httpGet(endpoint);
        if (response == null) {
            Log.e(TAG, "Failed to fetch vehicle list from server.");
            return Result.retry();
        }

        try {
            JSONArray serverList = new JSONArray(response);
            JSONObject cachedMap = new JSONObject(cachedVehiclesJson);
            JSONObject newMap = new JSONObject();
            
            // 最新のマップを作成
            for (int i = 0; i < serverList.length(); i++) {
                JSONObject v = serverList.getJSONObject(i);
                String id = v.getString("id");
                String status = v.getString("status");
                newMap.put(id, status);
            }

            // 初回ポーリング時はキャッシュがなく大量の重複通知が飛ぶのを防ぐため、キャッシュを生成して終了
            if (cachedMap.length() == 0 && serverList.length() > 0) {
                Log.d(TAG, "Initial run: Caching initial state of " + serverList.length() + " vehicles.");
                prefs.edit().putString("cachedVehicles", newMap.toString()).apply();
                return Result.success();
            }

            // 差分検出
            if ("admin".equals(role)) {
                // 管理者の場合: キャッシュに存在しない新しい "pending" 車両を検知
                int newPendingCount = 0;
                String firstCarDescription = "";
                
                for (int i = 0; i < serverList.length(); i++) {
                    JSONObject v = serverList.getJSONObject(i);
                    String id = v.getString("id");
                    String status = v.getString("status");
                    
                    if ("pending".equals(status) && !cachedMap.has(id)) {
                        newPendingCount++;
                        if (firstCarDescription.isEmpty()) {
                            String username = v.optString("roblox_username", "ユーザー");
                            String maker = v.optString("maker", "");
                            String model = v.optString("model", "");
                            firstCarDescription = username + " さんの「" + maker + " " + model + "」";
                        }
                    }
                }

                if (newPendingCount > 0) {
                    String title = "新規の車両登録申請";
                    String body = newPendingCount == 1 
                        ? "新規の登録申請が届きました: " + firstCarDescription 
                        : "新規の登録申請が " + newPendingCount + " 件届きました。";
                    sendNotification(context, title, body, "admin_notifications_channel", "管理者向け通知");
                }
            } else {
                // 一般ユーザーの場合: ステータスが "pending" から変化した車両を検知
                for (int i = 0; i < serverList.length(); i++) {
                    JSONObject v = serverList.getJSONObject(i);
                    String id = v.getString("id");
                    String status = v.getString("status");
                    
                    if (cachedMap.has(id)) {
                        String oldStatus = cachedMap.getString(id);
                        if ("pending".equals(oldStatus) && !"pending".equals(status)) {
                            // 承認・非推奨承認・仮承認・却下の出し分け
                            String statusText = "処理";
                            if ("approved".equals(status)) statusText = "承認";
                            else if ("approved_warning".equals(status)) statusText = "非推奨承認";
                            else if ("temp_approved".equals(status) || "temp".equals(status)) statusText = "仮承認";
                            else if ("rejected".equals(status)) statusText = "却下";
                            
                            String maker = v.optString("maker", "");
                            String model = v.optString("model", "");
                            String plate = v.optString("plate", "");
                            String title = "車両登録申請の結果";
                            String body = "車両「" + maker + " " + model + "」（ナンバー: " + plate + "）の申請が" + statusText + "されました。";
                            
                            if ("rejected".equals(status) && v.has("reject_reason") && !v.isNull("reject_reason")) {
                                body += " 理由: " + v.getString("reject_reason");
                            }
                            
                            sendNotification(context, title, body, "application_results_channel", "申請結果通知");

                            // Stop active LiveProgress tracker notification for resolved applications
                            try {
                                Intent stopServiceIntent = new Intent(context, LiveProgressService.class);
                                stopServiceIntent.setAction("STOP");
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                    context.startForegroundService(stopServiceIntent);
                                } else {
                                    context.startService(stopServiceIntent);
                                }
                            } catch (Exception e) {
                                Log.e(TAG, "Failed to stop LiveProgressService from background worker", e);
                            }
                        }
                    }
                }
            }

            // 新しい状態をキャッシュに保存
            prefs.edit().putString("cachedVehicles", newMap.toString()).apply();
            Log.d(TAG, "State successfully polled and cached.");

        } catch (Exception e) {
            Log.e(TAG, "Error parsing server response or diffing state", e);
            return Result.failure();
        }

        return Result.success();
    }

    private String httpGet(String urlString) {
        StringBuilder result = new StringBuilder();
        HttpURLConnection urlConnection = null;
        try {
            URL url = new URL(urlString);
            urlConnection = (HttpURLConnection) url.openConnection();
            urlConnection.setRequestMethod("GET");
            urlConnection.setConnectTimeout(10000);
            urlConnection.setReadTimeout(10000);
            urlConnection.setRequestProperty("Accept", "application/json");
            
            int statusCode = urlConnection.getResponseCode();
            if (statusCode == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(urlConnection.getInputStream()));
                String line;
                while ((line = reader.readLine()) != null) {
                    result.append(line);
                }
                reader.close();
                return result.toString();
            } else {
                Log.e(TAG, "HTTP GET returned status code: " + statusCode);
            }
        } catch (Exception e) {
            Log.e(TAG, "HTTP GET request failed", e);
        } finally {
            if (urlConnection != null) {
                urlConnection.disconnect();
            }
        }
        return null;
    }

    private void sendNotification(Context context, String title, String body, String channelId, String channelName) {
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        
        // Android 8.0 以上のチャンネル作成
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = notificationManager.getNotificationChannel(channelId);
            if (channel == null) {
                int importance = "admin_notifications_channel".equals(channelId) 
                    ? NotificationManager.IMPORTANCE_DEFAULT 
                    : NotificationManager.IMPORTANCE_HIGH;
                channel = new NotificationChannel(channelId, channelName, importance);
                channel.setDescription(channelName + "の通知をお届けします。");
                notificationManager.createNotificationChannel(channel);
            }
        }

        // 通知タップ時に起動する Intent を設定
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent, flags);

        // 通知作成 (ic_launcher を通知アイコンのフォールバックとして使用)
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(android.R.drawable.ic_dialog_info) // 標準のダイアログ情報アイコン (必要に応じてリソースic_launcherなどに変更)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true);

        // 通知IDの作成 (一意なIDを設定)
        int notificationId = (int) System.currentTimeMillis();
        notificationManager.notify(notificationId, builder.build());
        Log.d(TAG, "Local notification pushed: " + title);
    }
}
