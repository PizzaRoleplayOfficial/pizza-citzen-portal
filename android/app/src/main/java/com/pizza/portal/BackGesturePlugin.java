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

    // Use Object to avoid loading OnBackAnimationCallback class on pre-Android 14 devices
    private Object onBackAnimationCallback;
    private final boolean[] isCallbackRegistered = new boolean[]{false};

    @Override
    public void load() {
        super.load();

        // Initialize Native OnBackAnimationCallback for Android 14+ (API 34+) on Main Thread
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            getActivity().runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    onBackAnimationCallback = Api34Helper.createCallback(BackGesturePlugin.this);
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
                        Api34Helper.registerCallback(getActivity(), onBackAnimationCallback, enabled, isCallbackRegistered);
                    }
                }
            });
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    // Static helper class to encapsulate API 34+ dependencies.
    // This helper class is only resolved when the JVM accesses Api34Helper,
    // which only happens on Android 14+ due to the SDK_INT check.
    private static class Api34Helper {
        static Object createCallback(final BackGesturePlugin plugin) {
            return new OnBackAnimationCallback() {
                @Override
                public void onBackStarted(BackEvent backEvent) {
                    JSObject data = new JSObject();
                    data.put("progress", backEvent.getProgress());
                    data.put("swipeEdge", backEvent.getSwipeEdge());
                    data.put("touchX", backEvent.getTouchX());
                    data.put("touchY", backEvent.getTouchY());
                    plugin.notifyListeners("backStarted", data);
                }

                @Override
                public void onBackProgressed(BackEvent backEvent) {
                    JSObject data = new JSObject();
                    data.put("progress", backEvent.getProgress());
                    data.put("swipeEdge", backEvent.getSwipeEdge());
                    data.put("touchX", backEvent.getTouchX());
                    data.put("touchY", backEvent.getTouchY());
                    plugin.notifyListeners("backProgressed", data);
                }

                @Override
                public void onBackInvoked() {
                    plugin.notifyListeners("backPressed", null);
                }

                @Override
                public void onBackCancelled() {
                    plugin.notifyListeners("backCancelled", null);
                }
            };
        }

        static void registerCallback(android.app.Activity activity, Object callback, boolean enabled, boolean[] isRegisteredRef) {
            OnBackInvokedDispatcher dispatcher = activity.getOnBackInvokedDispatcher();
            OnBackAnimationCallback cb = (OnBackAnimationCallback) callback;
            if (enabled) {
                if (!isRegisteredRef[0]) {
                    dispatcher.registerOnBackInvokedCallback(
                        OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                        cb
                    );
                    isRegisteredRef[0] = true;
                }
            } else {
                if (isRegisteredRef[0]) {
                    dispatcher.unregisterOnBackInvokedCallback(cb);
                    isRegisteredRef[0] = false;
                }
            }
        }
    }
}
