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
    let measured = max(0, contentView.bounds.maxY - layout.maxY)
    if measured > 0 {
      return measured
    }

    return window.standardWindowButton(.closeButton)?.superview?.bounds.height ?? 28
  }

  static func isTitlebarPassthroughPoint(
    _ point: NSPoint,
    in bounds: NSRect,
    titlebarInset: CGFloat
  ) -> Bool {
    titlebarInset > 0 && point.y >= bounds.maxY - titlebarInset
  }

  static func titlebarInsetCSSValue(_ inset: CGFloat) -> String {
    "\(Int(inset.rounded(.toNearestOrAwayFromZero)))px"
  }
}
