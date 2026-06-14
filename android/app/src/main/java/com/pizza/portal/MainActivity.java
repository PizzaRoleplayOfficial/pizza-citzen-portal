package com.pizza.portal;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom native plugins
        registerPlugin(ApkInstallerPlugin.class);
        registerPlugin(PixelHapticsPlugin.class);
        registerPlugin(LiveUpdatePlugin.class);
        registerPlugin(BackgroundPollPlugin.class);
        registerPlugin(LiveProgressPlugin.class);
        registerPlugin(PhotoPickerPlugin.class);
        registerPlugin(BackGesturePlugin.class);

        super.onCreate(savedInstanceState);

        // Native offline check at startup to bypass cheap system error screens instantly
        if (!isNetworkAvailable()) {
            WebView webView = this.bridge.getWebView();
            if (webView != null) {
                webView.loadUrl("file:///android_asset/public/offline.html");
            }
        }

        // Enable WebAuthn/Passkey support in WebView (v2.2.76)
        WebView webView = this.bridge.getWebView();
        if (webView != null) {
            try {
                if (androidx.webkit.WebViewFeature.isFeatureSupported(androidx.webkit.WebViewFeature.WEB_AUTHENTICATION)) {
                    androidx.webkit.WebSettingsCompat.setWebAuthenticationSupport(
                        webView.getSettings(),
                        androidx.webkit.WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP
                    );
                }
            } catch (Throwable e) {
                e.printStackTrace();
            }
        }
    }

    private boolean isNetworkAvailable() {
        ConnectivityManager connectivityManager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (connectivityManager != null) {
            NetworkInfo activeNetworkInfo = connectivityManager.getActiveNetworkInfo();
            return activeNetworkInfo != null && activeNetworkInfo.isConnected();
        }
        return false;
    }

    @Override
    public void onPause() {
        super.onPause();
        // Prevent WebView from pausing to allow background HTML5 audio/video playback
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().onResume();
            this.bridge.getWebView().resumeTimers();
        }
    }

    @Override
    public void onStop() {
        super.onStop();
        // Prevent WebView from pausing when fully stopped/minimized to allow background play
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().onResume();
            this.bridge.getWebView().resumeTimers();
        }
    }
}
