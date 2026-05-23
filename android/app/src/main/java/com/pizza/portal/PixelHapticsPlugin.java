package com.pizza.portal;

import android.view.View;
import android.view.HapticFeedbackConstants;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PixelHaptics")
public class PixelHapticsPlugin extends Plugin {

    @PluginMethod
    public void trigger(PluginCall call) {
        String type = call.getString("type", "tick");
        
        // Execute on UI Thread for performHapticFeedback safety
        getBridge().getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                View view = getBridge().getWebView();
                if (view == null) {
                    call.reject("WebView is null");
                    return;
                }

                boolean success = false;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    switch (type) {
                        case "tick":
                            // CLOCK_TICK is the ultimate ultra-micro tick (reserved for ultra-delicate actions)
                            success = view.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK);
                            break;
                        case "light":
                            // Tuning: Upgraded to KEYBOARD_TAP to feel Gboard-style premium tactile click (stronger but crisp)
                            success = view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);
                            break;
                        case "selection":
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                                success = view.performHapticFeedback(HapticFeedbackConstants.TEXT_HANDLE_MOVE);
                            } else {
                                success = view.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK);
                            }
                            break;
                        case "medium":
                            // Upgraded to LONG_PRESS for a more distinctive medium bump
                            success = view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS);
                            break;
                        case "heavy":
                            // Upgraded to CONFIRM (or LONG_PRESS fallback) for a strong tactile feedback
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                                success = view.performHapticFeedback(HapticFeedbackConstants.CONFIRM);
                            } else {
                                success = view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS);
                            }
                            break;
                        case "success":
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                                success = view.performHapticFeedback(HapticFeedbackConstants.CONFIRM);
                            } else {
                                view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);
                                try { Thread.sleep(60); } catch(Exception e) {}
                                success = view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);
                            }
                            break;
                        case "warning":
                            view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS);
                            try { Thread.sleep(120); } catch(Exception e) {}
                            success = view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);
                            break;
                        case "error":
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                                success = view.performHapticFeedback(HapticFeedbackConstants.REJECT);
                            } else {
                                for(int i=0; i<3; i++) {
                                    view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS);
                                    if(i<2) { try { Thread.sleep(80); } catch(Exception e) {} }
                                }
                                success = true;
                            }
                            break;
                        default:
                            success = view.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK);
                            break;
                    }
                } else {
                    success = view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);
                }

                // Resolve call successfully
                call.resolve();
            }
        });
    }
}
