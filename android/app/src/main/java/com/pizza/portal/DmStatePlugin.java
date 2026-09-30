package com.pizza.portal;

import android.content.Context;
import android.util.Log;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DmState")
public class DmStatePlugin extends Plugin {

    private static final String TAG = "DmStatePlugin";

    @PluginMethod
    public void setActiveConversation(PluginCall call) {
        String conversationId = call.getString("conversationId", null);
        Log.d(TAG, "setActiveConversation: " + conversationId);
        PortalFirebaseMessagingService.setActiveConversationId(conversationId);

        // When a conversation is actively opened, automatically dismiss any pending notification for it
        if (conversationId != null && !conversationId.isEmpty()) {
            try {
                Context context = getContext();
                NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
                int notificationId = Math.abs(conversationId.hashCode());
                notificationManager.cancel(notificationId);
                Log.d(TAG, "Dismissed pending notification for conversation: " + conversationId + " (id=" + notificationId + ")");
            } catch (Exception e) {
                Log.w(TAG, "Failed to cancel notification for conversation: " + e.getMessage());
            }
        }

        call.resolve();
    }

    @PluginMethod
    public void clearActiveConversation(PluginCall call) {
        Log.d(TAG, "clearActiveConversation");
        PortalFirebaseMessagingService.setActiveConversationId(null);
        call.resolve();
    }
}
