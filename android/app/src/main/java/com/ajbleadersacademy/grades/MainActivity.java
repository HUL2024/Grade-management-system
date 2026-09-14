package com.ajbleadersacademy.grades;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Explicitly opt in to edge-to-edge on every Android version (it's
        // mandatory anyway on API 35+, so this makes behavior consistent
        // instead of version-dependent). The WebView will then correctly
        // report env(safe-area-inset-*) values in CSS, which the app uses
        // to keep content clear of the status bar, notch, and gesture nav.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        super.onCreate(savedInstanceState);
    }
}
