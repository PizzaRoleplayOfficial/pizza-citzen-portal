package com.pizza.portal;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom native plugins
        registerPlugin(ApkInstallerPlugin.class);

        super.onCreate(savedInstanceState);
    }
}
