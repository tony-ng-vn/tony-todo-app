import AppKit

enum NativeWindowPolicy {
  static let primaryStyleMask: NSWindow.StyleMask = [
    .titled,
    .closable,
    .miniaturizable,
    .resizable,
    .fullSizeContentView,
  ]

  static let canvasColor = NSColor(srgbRed: 20.0 / 255.0, green: 20.0 / 255.0, blue: 18.0 / 255.0, alpha: 1)

  @MainActor
  static func applyChrome(to window: NSWindow) {
    window.styleMask.formUnion(.fullSizeContentView)
    window.titleVisibility = .hidden
    window.titlebarAppearsTransparent = true
    window.titlebarSeparatorStyle = .none
    window.appearance = NSAppearance(named: .darkAqua)
    window.isOpaque = true
    window.backgroundColor = canvasColor
    window.isMovableByWindowBackground = true
  }

  static func standardFrame(
    defaultFrame: NSRect,
    screenVisibleFrame: NSRect?
  ) -> NSRect {
    screenVisibleFrame ?? defaultFrame
  }

  static func fullScreenMenuTitle(isFullScreen: Bool) -> String {
    isFullScreen ? "Exit Full Screen" : "Enter Full Screen"
  }

  @MainActor
  static func titlebarInset(in contentView: NSView, window: NSWindow) -> CGFloat {
    let layout = contentView.convert(window.contentLayoutRect, from: nil)
    return titlebarInset(
      layoutRect: layout,
      bounds: contentView.bounds,
      isFlipped: contentView.isFlipped,
      isFullScreen: window.styleMask.contains(.fullScreen)
    )
  }

  static func titlebarInset(
    layoutRect: NSRect,
    bounds: NSRect,
    isFlipped: Bool,
    isFullScreen: Bool
  ) -> CGFloat {
    guard !isFullScreen else {
      return 0
    }

    return isFlipped
      ? max(0, layoutRect.minY - bounds.minY)
      : max(0, bounds.maxY - layoutRect.maxY)
  }

  static func isTitlebarPassthroughPoint(
    _ point: NSPoint,
    in bounds: NSRect,
    titlebarInset: CGFloat,
    isFlipped: Bool
  ) -> Bool {
    guard titlebarInset > 0, bounds.contains(point) else {
      return false
    }

    if isFlipped {
      return point.y < bounds.minY + titlebarInset
    }

    return point.y >= bounds.maxY - titlebarInset
  }

  static func titlebarInsetCSSValue(_ inset: CGFloat) -> String {
    "\(Int(inset.rounded(.toNearestOrAwayFromZero)))px"
  }
}
