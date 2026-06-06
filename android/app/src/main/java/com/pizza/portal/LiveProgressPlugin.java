package com.pizza.portal;

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LiveProgress")
public class LiveProgressPlugin extends Plugin {

    /** START: 新規または上書き起動。segments/points も含めてすべて設定する。 */
    @PluginMethod
    public void start(PluginCall call) {
        String title    = call.getString("title");
        String text     = call.getString("text");
        Integer progress = call.getInt("progress", 0);
        String segments = call.getString("segments");
        String points   = call.getString("points");

        if (title == null || text == null) {
            call.reject("title and text are required");
            return;
        }

        try {
            Intent serviceIntent = new Intent(getContext(), LiveProgressService.class);
            serviceIntent.setAction(LiveProgressService.ACTION_START);
            serviceIntent.putExtra("title", title);
            serviceIntent.putExtra("text", text);
            serviceIntent.putExtra("progress", progress);
            if (segments != null) serviceIntent.putExtra("segments", segments);
            if (points   != null) serviceIntent.putExtra("points", points);

            startService(serviceIntent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to start LiveProgress service: " + e.getMessage(), e);
        }
    }

    /**
     * UPDATE: 既に起動中のサービスに進捗のみ通知する。
     * segments/points は省略した場合はサービス側で保持している前回値を使う。
     */
    @PluginMethod
    public void update(PluginCall call) {
        String title    = call.getString("title");
        String text     = call.getString("text");
        Integer progress = call.getInt("progress", 0);
        String segments = call.getString("segments");
        String points   = call.getString("points");

        if (title == null || text == null) {
            call.reject("title and text are required");
            return;
        }

        try {
            Intent serviceIntent = new Intent(getContext(), LiveProgressService.class);
            serviceIntent.setAction(LiveProgressService.ACTION_UPDATE);
            serviceIntent.putExtra("title", title);
            serviceIntent.putExtra("text", text);
            serviceIntent.putExtra("progress", progress);
            if (segments != null) serviceIntent.putExtra("segments", segments);
            if (points   != null) serviceIntent.putExtra("points", points);

            // If service is not running (e.g. killed by OS), fallback to START
            startService(serviceIntent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to update LiveProgress service: " + e.getMessage(), e);
        }
    }

    /** STOP: 通知を消去してサービスを停止する。 */
    @PluginMethod
    public void stop(PluginCall call) {
        try {
            Intent serviceIntent = new Intent(getContext(), LiveProgressService.class);
            serviceIntent.setAction(LiveProgressService.ACTION_STOP);
            startService(serviceIntent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to stop LiveProgress service: " + e.getMessage(), e);
        }
    }

    /** startService のヘルパー（API レベルに応じて foreground/通常 を切り替え） */
    private void startService(Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
    }
}
