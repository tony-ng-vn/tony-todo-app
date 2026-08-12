import AppKit

@MainActor
final class NativeWindowCommandHandler: NSObject, NSMenuItemValidation {
  private var activeWindow: NSWindow? {
    NSApp.keyWindow
      ?? NSApp.mainWindow
      ?? NSApp.windows.first { $0.isVisible && !$0.isMiniaturized }
  }

  @objc
  func closeWindow(_ sender: Any?) {
    activeWindow?.performClose(sender)
  }

  @objc
  func minimizeWindow(_ sender: Any?) {
    activeWindow?.performMiniaturize(sender)
  }

  @objc
  func zoomWindow(_ sender: Any?) {
    activeWindow?.performZoom(sender)
  }

  @objc
  func toggleFullScreen(_ sender: Any?) {
    activeWindow?.toggleFullScreen(sender)
  }

  @objc
  func bringAllToFront(_ sender: Any?) {
    NSApp.arrangeInFront(sender)
  }

  func validateMenuItem(_ menuItem: NSMenuItem) -> Bool {
    if menuItem.action == #selector(bringAllToFront(_:)) {
      return NSApp.windows.contains { $0.isVisible || $0.isMiniaturized }
    }

    guard let activeWindow else {
      return false
    }

    if menuItem.action == #selector(toggleFullScreen(_:)) {
      menuItem.title = NativeWindowPolicy.fullScreenMenuTitle(
        isFullScreen: activeWindow.styleMask.contains(.fullScreen)
      )
    }

    return true
  }
}
