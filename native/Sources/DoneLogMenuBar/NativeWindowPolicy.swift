import AppKit

enum NativeWindowPolicy {
  static let chromeMessageName = "doneLogWindow"
  static let defaultTrafficLightsLeadingInset: CGFloat = 78

  static let primaryStyleMask: NSWindow.StyleMask = [
    .titled,
    .closable,
    .miniaturizable,
    .resizable,
    .fullSizeContentView,
  ]

  static let floatingNoteStyleMask = primaryStyleMask

  static let canvasColor = NSColor(srgbRed: 20.0 / 255.0, green: 20.0 / 255.0, blue: 18.0 / 255.0, alpha: 1)

  enum ChromeCommand: Equatable {
    case drag
    case zoom
  }

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
    trafficLightsLeadingInset: CGFloat,
    isFlipped: Bool
  ) -> Bool {
    guard titlebarInset > 0, trafficLightsLeadingInset > 0, bounds.contains(point) else {
      return false
    }

    let inTitlebar: Bool
    if isFlipped {
      inTitlebar = point.y < bounds.minY + titlebarInset
    } else {
      inTitlebar = point.y >= bounds.maxY - titlebarInset
    }

    return inTitlebar && point.x < bounds.minX + trafficLightsLeadingInset
  }

  @MainActor
  static func trafficLightsLeadingInset(in contentView: NSView, window: NSWindow) -> CGFloat {
    guard !window.styleMask.contains(.fullScreen) else {
      return 0
    }

    guard let zoomButton = window.standardWindowButton(.zoomButton) else {
      return defaultTrafficLightsLeadingInset
    }

    let zoomFrame = contentView.convert(zoomButton.bounds, from: zoomButton)
    return trafficLightsLeadingInset(zoomMaxX: zoomFrame.maxX)
  }

  static func trafficLightsLeadingInset(
    zoomMaxX: CGFloat,
    trailingPadding: CGFloat = 12
  ) -> CGFloat {
    max(defaultTrafficLightsLeadingInset, zoomMaxX + trailingPadding)
  }

  static func chromeCommand(from body: Any) -> ChromeCommand? {
    let command: String?
    if let payload = body as? [String: String] {
      command = payload["command"]
    } else if let payload = body as? [String: Any] {
      command = payload["command"] as? String
    } else if let payload = body as? NSDictionary {
      command = payload["command"] as? String
    } else {
      command = nil
    }

    switch command {
    case "drag":
      return .drag
    case "zoom":
      return .zoom
    default:
      return nil
    }
  }

  static func titlebarInsetCSSValue(_ inset: CGFloat) -> String {
    "\(Int(inset.rounded(.toNearestOrAwayFromZero)))px"
  }
}
