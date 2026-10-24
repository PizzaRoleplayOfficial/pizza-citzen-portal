package com.pizza.portal;

import android.content.Context;
import android.content.res.Configuration;
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
        registerPlugin(DmStatePlugin.class);
        registerPlugin(MaterialYouPlugin.class);

        super.onCreate(savedInstanceState);

        // Register Android Notification Channels
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            android.app.NotificationManager notificationManager = (android.app.NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                // DM Messages Channel (HIGH importance for popup banner and sound)
                android.app.NotificationChannel dmChannel = new android.app.NotificationChannel(
                    "dm_messages_channel",
                    "ダイレクトメッセージ",
                    android.app.NotificationManager.IMPORTANCE_HIGH
                );
                dmChannel.setDescription("DMや個別メッセージの受信を通知します。");
                dmChannel.enableVibration(true);
                dmChannel.enableLights(true);
                notificationManager.createNotificationChannel(dmChannel);
            }
        }

        // Native offline check at startup to bypass cheap system error screens instantly
        if (!isNetworkAvailable()) {
            WebView webView = this.bridge.getWebView();
            if (webView != null) {
                webView.loadUrl("file:///android_asset/public/offline.html");
            }
        }

        // Enable WebAuthn/Passkey support and Material You Dynamic Color bridge in WebView
        WebView webView = this.bridge.getWebView();
        if (webView != null) {
            try {
                webView.addJavascriptInterface(new MaterialYouPlugin.WebAppMaterialYouBridge(this), "AndroidMaterialYou");
                MaterialYouPlugin.pushToWebView(webView, this);
            } catch (Throwable e) {
                e.printStackTrace();
            }
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
    public void onResume() {
        super.onResume();
        PortalFirebaseMessagingService.setAppForeground(true);
        if (this.bridge != null && this.bridge.getWebView() != null) {
            MaterialYouPlugin.pushToWebView(this.bridge.getWebView(), this);
        }
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        if (this.bridge != null && this.bridge.getWebView() != null) {
            MaterialYouPlugin.pushToWebView(this.bridge.getWebView(), this);
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        PortalFirebaseMessagingService.setAppForeground(false);
        // Prevent WebView from pausing to allow background HTML5 audio/video playback
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().onResume();
            this.bridge.getWebView().resumeTimers();
        }
    }

    @Override
    public void onStop() {
        super.onStop();
        PortalFirebaseMessagingService.setAppForeground(false);
        // Prevent WebView from pausing when fully stopped/minimized to allow background play
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().onResume();
            this.bridge.getWebView().resumeTimers();
        }
    }
}
