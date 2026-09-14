import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * Configures the native status bar to overlay the WebView (required for
 * true edge-to-edge, matching MainActivity's setDecorFitsSystemWindows(false))
 * with light icons/text, since the app's theme is dark. Safe to call on web
 * too — it just no-ops there.
 */
export async function setupNativeChrome() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Light });
  } catch {
    // Some devices/OS versions may not support every call — never block app startup on this.
  }
}
