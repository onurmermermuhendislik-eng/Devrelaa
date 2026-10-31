package com.altez.minilab.v4;

import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.webkit.JavascriptInterface;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // V8.2: ana menu/tanitim serbest yon; oyun ekranlari yatay. Yeni eklenti yok: WebView'e kucuk bir kopru eklenir (src/core/orient.js kullanir).
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            getBridge().getWebView().addJavascriptInterface(new OrientationBridge(), "AltezOrientation");
        } catch (Throwable ignored) {
            // kopru kurulamazsa web yedegi (screen.orientation) ve CSS "cihazi cevir" uyarisi devrede kalir
        }
    }

    private class OrientationBridge {
        @JavascriptInterface
        public void lockLandscape() {
            runOnUiThread(() -> setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE));
        }

        @JavascriptInterface
        public void unlock() {
            runOnUiThread(() -> setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED));
        }
    }
}
