package com.pizza.portal;

import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PhotoPicker")
public class PhotoPickerPlugin extends Plugin {

    @PluginMethod
    public void pickImages(PluginCall call) {
        int maxCount = call.getInt("maxSelectionCount", 1);
        if (maxCount < 1) maxCount = 1;
        if (maxCount > 100) maxCount = 100;

        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent = new Intent("android.provider.action.PICK_IMAGES");
            intent.setType("image/*");
            if (maxCount > 1) {
                intent.putExtra("android.provider.extra.PICK_IMAGES_MAX", maxCount);
            }
        } else {
            intent = new Intent(Intent.ACTION_GET_CONTENT);
            intent.setType("image/*");
            if (maxCount > 1) {
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            }
        }

        try {
            startActivityForResult(call, intent, "pickImagesResult");
        } catch (Exception e) {
            try {
                Intent fallbackIntent = new Intent(Intent.ACTION_PICK, android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI);
                if (maxCount > 1) {
                    fallbackIntent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                }
                startActivityForResult(call, fallbackIntent, "pickImagesResult");
            } catch (Exception ex) {
                call.reject("Failed to launch any photo picker: " + ex.getMessage(), ex);
            }
        }
    }

    @ActivityCallback
    private void pickImagesResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        if (result.getResultCode() == android.app.Activity.RESULT_CANCELED) {
            call.reject("User cancelled image selection");
            return;
        }

        if (result.getResultCode() != android.app.Activity.RESULT_OK || result.getData() == null) {
            call.reject("Failed to select images: no data");
            return;
        }

        Intent data = result.getData();
        JSObject response = new JSObject();
        JSArray paths = new JSArray();

        try {
            if (data.getClipData() != null) {
                ClipData clipData = data.getClipData();
                int count = clipData.getItemCount();
                for (int i = 0; i < count; i++) {
                    Uri uri = clipData.getItemAt(i).getUri();
                    paths.put(uri.toString());
                }
            } else if (data.getData() != null) {
                Uri uri = data.getData();
                paths.put(uri.toString());
            }

            response.put("paths", paths);
            call.resolve(response);
        } catch (Exception e) {
            call.reject("Error parsing image result: " + e.getMessage(), e);
        }
    }
}
