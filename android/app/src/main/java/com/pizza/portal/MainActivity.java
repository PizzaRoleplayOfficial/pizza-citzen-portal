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

        super.onCreate(savedInstanceState);

        // Native offline check at startup to bypass cheap system error screens instantly
        if (!isNetworkAvailable()) {
            WebView webView = this.bridge.getWebView();
            if (webView != null) {
                webView.loadUrl("file:///android_asset/public/offline.html");
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
        }
    }
}
