package com.pizza.portal;

import android.os.Build;
import android.window.BackEvent;
import android.window.OnBackAnimationCallback;
import android.window.OnBackInvokedDispatcher;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BackGesture")
public class BackGesturePlugin extends Plugin {

    private OnBackAnimationCallback onBackAnimationCallback;
    private boolean isCallbackRegistered = false;

    @Override
    public void load() {
        super.load();

        // Initialize Native OnBackAnimationCallback for Android 14+ (API 34+) on Main Thread
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            getActivity().runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    onBackAnimationCallback = new OnBackAnimationCallback() {
                        @Override
                        public void onBackStarted(BackEvent backEvent) {
                            JSObject data = new JSObject();
                            data.put("progress", backEvent.getProgress());
                            data.put("swipeEdge", backEvent.getSwipeEdge());
                            data.put("touchX", backEvent.getTouchX());
                            data.put("touchY", backEvent.getTouchY());
                            notifyListeners("backStarted", data);
                        }

                        @Override
                        public void onBackProgressed(BackEvent backEvent) {
                            JSObject data = new JSObject();
                            data.put("progress", backEvent.getProgress());
                            data.put("swipeEdge", backEvent.getSwipeEdge());
                            data.put("touchX", backEvent.getTouchX());
                            data.put("touchY", backEvent.getTouchY());
                            notifyListeners("backProgressed", data);
                        }

                        @Override
                        public void onBackInvoked() {
                            notifyListeners("backPressed", null);
                        }

                        @Override
                        public void onBackCancelled() {
                            notifyListeners("backCancelled", null);
                        }
                    };
                }
            });
        }
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled");
        if (enabled == null) {
            call.reject("enabled parameter is required");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            getActivity().runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (onBackAnimationCallback != null) {
                        OnBackInvokedDispatcher dispatcher = getActivity().getOnBackInvokedDispatcher();
                        if (enabled) {
                            if (!isCallbackRegistered) {
                                // Register callback with default priority
                                dispatcher.registerOnBackInvokedCallback(
                                    OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                                    onBackAnimationCallback
                                );
                                isCallbackRegistered = true;
                            }
                        } else {
                            if (isCallbackRegistered) {
                                dispatcher.unregisterOnBackInvokedCallback(onBackAnimationCallback);
                                isCallbackRegistered = false;
                            }
                        }
                    }
                }
            });
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }
}
