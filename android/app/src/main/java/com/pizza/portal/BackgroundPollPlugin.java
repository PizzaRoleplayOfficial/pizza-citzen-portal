package com.pizza.portal;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "BackgroundPoll")
public class BackgroundPollPlugin extends Plugin {
    private static final String TAG = "BackgroundPollPlugin";
    private static final String PREFS_NAME = "BackgroundPollPrefs";
    private static final String WORK_NAME = "BackgroundPollWork";

    @PluginMethod
    public void setupPoll(PluginCall call) {
        String userId = call.getString("userId");
        String role = call.getString("role");
        String domain = call.getString("domain");

        if (userId == null || domain == null) {
            call.reject("userId and domain are required.");
            return;
        }

        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            
            // 設定を書き込む
            prefs.edit()
                .putString("userId", userId)
                .putString("role", role == null ? "user" : role)
                .putString("domain", domain)
                .apply();

            Log.d(TAG, "Setting up WorkManager periodic task for userId: " + userId);
            
            // 定期タスク (15分間隔) のスケジュール
            PeriodicWorkRequest pollRequest = new PeriodicWorkRequest.Builder(
                BackgroundWorker.class,
                15,
                TimeUnit.MINUTES
            ).build();

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                pollRequest
            );

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to setup WorkManager task", e);
            call.reject("WorkManager setup failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopPoll(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            
            // 設定をクリア
            prefs.edit()
                .remove("userId")
                .remove("role")
                .remove("domain")
                .remove("cachedVehicles")
                .apply();

            Log.d(TAG, "Stopping WorkManager periodic task.");
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to cancel WorkManager task", e);
            call.reject("Cancel failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void updateCache(PluginCall call) {
        String vehiclesMapJson = call.getString("vehiclesJson");
        if (vehiclesMapJson == null) {
            call.reject("vehiclesJson is required.");
            return;
        }

        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            
            // 最新の車両状態マップをキャッシュとして書き込む
            prefs.edit().putString("cachedVehicles", vehiclesMapJson).apply();
            Log.d(TAG, "Cached state updated from JS.");

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to update cache", e);
            call.reject("Update cache failed: " + e.getMessage());
        }
    }
}
