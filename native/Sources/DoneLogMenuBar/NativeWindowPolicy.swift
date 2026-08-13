import AppKit

enum NativeWindowPolicy {
  static let primaryStyleMask: NSWindow.StyleMask = [
    .titled,
    .closable,
    .miniaturizable,
    .resizable,
    .fullSizeContentView,
  ]

  @MainActor
  static func applyChrome(to window: NSWindow) {
    window.titleVisibility = .hidden
    window.titlebarAppearsTransparent = true
    window.titlebarSeparatorStyle = .none
    window.isOpaque = false
    window.backgroundColor = .clear
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
}
