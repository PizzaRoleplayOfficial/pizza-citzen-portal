package com.pizza.portal;

import android.os.Build;
import androidx.activity.BackEventCompat;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BackGesture")
public class BackGesturePlugin extends Plugin {

    private OnBackPressedCallback onBackPressedCallback;

    @Override
    public void load() {
        super.load();

        // Initialize and register OnBackPressedCallback on the main UI thread
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                onBackPressedCallback = new OnBackPressedCallback(false) { // Start as disabled (since initial screen is home)
                    @Override
                    public void handleOnBackStarted(BackEventCompat backEvent) {
                        JSObject data = new JSObject();
                        data.put("progress", backEvent.getProgress());
                        data.put("swipeEdge", backEvent.getSwipeEdge());
                        data.put("touchX", backEvent.getTouchX());
                        data.put("touchY", backEvent.getTouchY());
                        notifyListeners("backStarted", data);
                    }

                    @Override
                    public void handleOnBackProgressed(BackEventCompat backEvent) {
                        JSObject data = new JSObject();
                        data.put("progress", backEvent.getProgress());
                        data.put("swipeEdge", backEvent.getSwipeEdge());
                        data.put("touchX", backEvent.getTouchX());
                        data.put("touchY", backEvent.getTouchY());
                        notifyListeners("backProgressed", data);
                    }

                    @Override
                    public void handleOnBackPressed() {
                        notifyListeners("backPressed", null);
                    }

                    @Override
                    public void handleOnBackCancelled() {
                        notifyListeners("backCancelled", null);
                    }
                };

                getActivity().getOnBackPressedDispatcher().addCallback(getActivity(), onBackPressedCallback);
            }
        });
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled");
        if (enabled == null) {
            call.reject("enabled parameter is required");
            return;
        }

        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (onBackPressedCallback != null) {
                    onBackPressedCallback.setEnabled(enabled);
                }
            }
        });

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }
}
