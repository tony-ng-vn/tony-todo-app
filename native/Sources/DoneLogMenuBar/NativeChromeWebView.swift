import AppKit
import WebKit

final class NativeChromeWebView: WKWebView {
  var titlebarPassthroughHeight: CGFloat = 0

  override func hitTest(_ point: NSPoint) -> NSView? {
    if NativeWindowPolicy.isTitlebarPassthroughPoint(
      point,
      in: bounds,
      titlebarInset: titlebarPassthroughHeight,
      isFlipped: isFlipped
    ) {
      return nil
    }

    return super.hitTest(point)
  }
}
