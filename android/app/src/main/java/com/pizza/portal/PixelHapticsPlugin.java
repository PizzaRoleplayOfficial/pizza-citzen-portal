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
                        case "light":
                            // CLOCK_TICK is the ultimate micro-haptics used by Gboard/System UI on Google Pixel
                            success = view.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK);
                            break;
                        case "selection":
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                                success = view.performHapticFeedback(HapticFeedbackConstants.TEXT_HANDLE_MOVE);
                            } else {
                                success = view.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK);
                            }
                            break;
                        case "medium":
                            success = view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);
                            break;
                        case "heavy":
                            success = view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS);
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
