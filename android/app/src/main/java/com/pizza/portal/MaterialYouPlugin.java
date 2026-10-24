package com.pizza.portal;

import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MaterialYou")
public class MaterialYouPlugin extends Plugin {

    private static String toHex(int color) {
        return String.format("#%06X", (0xFFFFFF & color));
    }

    private static int blendColors(int color1, int color2, float ratio) {
        final float inverseRatio = 1f - ratio;
        float r = (Color.red(color1) * inverseRatio) + (Color.red(color2) * ratio);
        float g = (Color.green(color1) * inverseRatio) + (Color.green(color2) * ratio);
        float b = (Color.blue(color1) * inverseRatio) + (Color.blue(color2) * ratio);
        return Color.rgb((int) r, (int) g, (int) b);
    }

    public static boolean isSystemDark(Context context) {
        int nightModeFlags = context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return nightModeFlags == Configuration.UI_MODE_NIGHT_YES;
    }

    public static JSObject buildThemePayload(Context context) {
        JSObject result = new JSObject();
        boolean dark = isSystemDark(context);
        result.put("systemDark", dark);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                result.put("supported", true);

                // Accent 1 (Primary Tonal Palette)
                int a1_0 = ContextCompat.getColor(context, android.R.color.system_accent1_0);
                int a1_100 = ContextCompat.getColor(context, android.R.color.system_accent1_100);
                int a1_200 = ContextCompat.getColor(context, android.R.color.system_accent1_200);
                int a1_600 = ContextCompat.getColor(context, android.R.color.system_accent1_600);
                int a1_700 = ContextCompat.getColor(context, android.R.color.system_accent1_700);
                int a1_800 = ContextCompat.getColor(context, android.R.color.system_accent1_800);
                int a1_900 = ContextCompat.getColor(context, android.R.color.system_accent1_900);

                // Accent 2 (Secondary Tonal Palette)
                int a2_0 = ContextCompat.getColor(context, android.R.color.system_accent2_0);
                int a2_100 = ContextCompat.getColor(context, android.R.color.system_accent2_100);
                int a2_200 = ContextCompat.getColor(context, android.R.color.system_accent2_200);
                int a2_600 = ContextCompat.getColor(context, android.R.color.system_accent2_600);
                int a2_700 = ContextCompat.getColor(context, android.R.color.system_accent2_700);
                int a2_800 = ContextCompat.getColor(context, android.R.color.system_accent2_800);
                int a2_900 = ContextCompat.getColor(context, android.R.color.system_accent2_900);

                // Accent 3 (Tertiary Tonal Palette)
                int a3_0 = ContextCompat.getColor(context, android.R.color.system_accent3_0);
                int a3_100 = ContextCompat.getColor(context, android.R.color.system_accent3_100);
                int a3_200 = ContextCompat.getColor(context, android.R.color.system_accent3_200);
                int a3_600 = ContextCompat.getColor(context, android.R.color.system_accent3_600);
                int a3_700 = ContextCompat.getColor(context, android.R.color.system_accent3_700);
                int a3_800 = ContextCompat.getColor(context, android.R.color.system_accent3_800);
                int a3_900 = ContextCompat.getColor(context, android.R.color.system_accent3_900);

                // Neutral 1 (Surface / Neutral Tonal Palette)
                int n1_0 = ContextCompat.getColor(context, android.R.color.system_neutral1_0);     // Tone 100
                int n1_10 = ContextCompat.getColor(context, android.R.color.system_neutral1_10);   // Tone 99
                int n1_50 = ContextCompat.getColor(context, android.R.color.system_neutral1_50);   // Tone 95
                int n1_100 = ContextCompat.getColor(context, android.R.color.system_neutral1_100); // Tone 90
                int n1_700 = ContextCompat.getColor(context, android.R.color.system_neutral1_700); // Tone 30
                int n1_800 = ContextCompat.getColor(context, android.R.color.system_neutral1_800); // Tone 20
                int n1_900 = ContextCompat.getColor(context, android.R.color.system_neutral1_900); // Tone 10
                int n1_1000 = ContextCompat.getColor(context, android.R.color.system_neutral1_1000); // Tone 0

                // Neutral 2 (Surface Variant / Outline Tonal Palette)
                int n2_200 = ContextCompat.getColor(context, android.R.color.system_neutral2_200); // Tone 80
                int n2_400 = ContextCompat.getColor(context, android.R.color.system_neutral2_400); // Tone 60
                int n2_500 = ContextCompat.getColor(context, android.R.color.system_neutral2_500); // Tone 50
                int n2_700 = ContextCompat.getColor(context, android.R.color.system_neutral2_700); // Tone 30

                // M3 Expressive Light Tonal Surface hierarchy (Tones 98, 100, 96, 94, 92, 90)
                JSObject light = new JSObject();
                light.put("--md-sys-color-surface", toHex(blendColors(n1_10, n1_50, 0.25f))); // Tone 98
                light.put("--md-sys-color-surface-container-lowest", toHex(n1_0));             // Tone 100
                light.put("--md-sys-color-surface-container-low", toHex(blendColors(n1_10, n1_50, 0.75f))); // Tone 96
                light.put("--md-sys-color-surface-container", toHex(blendColors(n1_50, n1_100, 0.20f)));    // Tone 94
                light.put("--md-sys-color-surface-container-high", toHex(blendColors(n1_50, n1_100, 0.60f))); // Tone 92
                light.put("--md-sys-color-surface-container-highest", toHex(n1_100));          // Tone 90
                light.put("--md-sys-color-on-surface", toHex(n1_900));                         // Tone 10
                light.put("--md-sys-color-on-surface-variant", toHex(n2_700));                 // Tone 30
                light.put("--md-sys-color-primary", toHex(a1_600));                            // Tone 40
                light.put("--md-sys-color-on-primary", toHex(a1_0));                           // Tone 100
                light.put("--md-sys-color-primary-container", toHex(a1_100));                  // Tone 90
                light.put("--md-sys-color-on-primary-container", toHex(a1_900));               // Tone 10
                light.put("--md-sys-color-secondary", toHex(a2_600));                          // Tone 40
                light.put("--md-sys-color-on-secondary", toHex(a2_0));                         // Tone 100
                light.put("--md-sys-color-secondary-container", toHex(a2_100));                // Tone 90
                light.put("--md-sys-color-on-secondary-container", toHex(a2_900));             // Tone 10
                light.put("--md-sys-color-tertiary", toHex(a3_600));                           // Tone 40
                light.put("--md-sys-color-on-tertiary", toHex(a3_0));                          // Tone 100
                light.put("--md-sys-color-tertiary-container", toHex(a3_100));                 // Tone 90
                light.put("--md-sys-color-on-tertiary-container", toHex(a3_900));              // Tone 10
                light.put("--md-sys-color-outline", toHex(n2_500));                            // Tone 50
                light.put("--md-sys-color-outline-variant", toHex(n2_200));                    // Tone 80

                // M3 Expressive Dark Tonal Surface hierarchy (Tones 6, 4, 10, 12, 17, 22)
                JSObject darkPalette = new JSObject();
                darkPalette.put("--md-sys-color-surface", toHex(blendColors(n1_1000, n1_900, 0.60f))); // Tone 6
                darkPalette.put("--md-sys-color-surface-container-lowest", toHex(blendColors(n1_1000, n1_900, 0.40f))); // Tone 4
                darkPalette.put("--md-sys-color-surface-container-low", toHex(n1_900));        // Tone 10
                darkPalette.put("--md-sys-color-surface-container", toHex(blendColors(n1_900, n1_800, 0.20f))); // Tone 12
                darkPalette.put("--md-sys-color-surface-container-high", toHex(blendColors(n1_900, n1_800, 0.70f))); // Tone 17
                darkPalette.put("--md-sys-color-surface-container-highest", toHex(blendColors(n1_800, n1_700, 0.20f))); // Tone 22
                darkPalette.put("--md-sys-color-on-surface", toHex(n1_100));                   // Tone 90
                darkPalette.put("--md-sys-color-on-surface-variant", toHex(n2_200));           // Tone 80
                darkPalette.put("--md-sys-color-primary", toHex(a1_200));                      // Tone 80
                darkPalette.put("--md-sys-color-on-primary", toHex(a1_800));                   // Tone 20
                darkPalette.put("--md-sys-color-primary-container", toHex(a1_700));            // Tone 30
                darkPalette.put("--md-sys-color-on-primary-container", toHex(a1_100));         // Tone 90
                darkPalette.put("--md-sys-color-secondary", toHex(a2_200));                    // Tone 80
                darkPalette.put("--md-sys-color-on-secondary", toHex(a2_800));                 // Tone 20
                darkPalette.put("--md-sys-color-secondary-container", toHex(a2_700));          // Tone 30
                darkPalette.put("--md-sys-color-on-secondary-container", toHex(a2_100));       // Tone 90
                darkPalette.put("--md-sys-color-tertiary", toHex(a3_200));                     // Tone 80
                darkPalette.put("--md-sys-color-on-tertiary", toHex(a3_800));                  // Tone 20
                darkPalette.put("--md-sys-color-tertiary-container", toHex(a3_700));           // Tone 30
                darkPalette.put("--md-sys-color-on-tertiary-container", toHex(a3_100));        // Tone 90
                darkPalette.put("--md-sys-color-outline", toHex(n2_400));                      // Tone 60
                darkPalette.put("--md-sys-color-outline-variant", toHex(n2_700));              // Tone 30

                result.put("light", light);
                result.put("dark", darkPalette);
            } catch (Throwable t) {
                result.put("supported", false);
            }
        } else {
            result.put("supported", false);
        }

        return result;
    }

    @PluginMethod
    public void getSystemThemeAndPalette(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context is null");
            return;
        }
        call.resolve(buildThemePayload(context));
    }

    public static void pushToWebView(final WebView webView, final Context context) {
        if (webView == null || context == null) return;
        final String payloadJson = buildThemePayload(context).toString();
        webView.post(new Runnable() {
            @Override
            public void run() {
                String js = "window.__ANDROID_MATERIAL_YOU__ = " + payloadJson + ";" +
                            "window.dispatchEvent(new CustomEvent('android-material-you-update', { detail: window.__ANDROID_MATERIAL_YOU__ }));";
                webView.evaluateJavascript(js, null);
            }
        });
    }

    public static class WebAppMaterialYouBridge {
        private final Context context;

        public WebAppMaterialYouBridge(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public String getThemeJson() {
            return buildThemePayload(context).toString();
        }
    }
}
