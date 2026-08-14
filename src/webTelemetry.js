// Vercel analytics and speed-insights measure the public web app. The menubar
// popover opens on every menu bar click and the native windows wrap the same
// pages in a WKWebView; loading two beacon scripts there costs startup latency
// on the app's most latency-sensitive surface and measures nothing useful.
export function shouldLoadWebTelemetry({ pathname, nativeHost }) {
  if (nativeHost) {
    return false;
  }

  return !String(pathname ?? '').startsWith('/menubar');
}
