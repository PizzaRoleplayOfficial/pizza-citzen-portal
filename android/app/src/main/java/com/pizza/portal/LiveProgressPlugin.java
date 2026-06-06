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

    @PluginMethod
    public void start(PluginCall call) {
        String title = call.getString("title");
        String text = call.getString("text");
        Integer progress = call.getInt("progress", 0);
        String segments = call.getString("segments"); // JSON string
        String points = call.getString("points"); // JSON string

        if (title == null || text == null) {
            call.reject("title and text are required");
            return;
        }

        try {
            Intent serviceIntent = new Intent(getContext(), LiveProgressService.class);
            serviceIntent.putExtra("title", title);
            serviceIntent.putExtra("text", text);
            serviceIntent.putExtra("progress", progress);
            if (segments != null) serviceIntent.putExtra("segments", segments);
            if (points != null) serviceIntent.putExtra("points", points);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(serviceIntent);
            } else {
                getContext().startService(serviceIntent);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to start LiveProgress service: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void update(PluginCall call) {
        // Just call start again to update the service notification parameters
        start(call);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            Intent serviceIntent = new Intent(getContext(), LiveProgressService.class);
            serviceIntent.setAction("STOP");
            
            // start service with STOP action to self-terminate
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(serviceIntent);
            } else {
                getContext().startService(serviceIntent);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to stop LiveProgress service: " + e.getMessage(), e);
        }
    }
}
