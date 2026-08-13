import AppKit

@MainActor
final class FloatingNoteWindowController: NSWindowController, NSWindowDelegate {
  private let contentController: MenuBarWebViewController
  private let onClose: () -> Void
  private var hasBeenShown = false

  init(
    url: URL,
    updateChecker: (any AppUpdateChecking)? = nil,
    onShowMenuBar: (() -> Void)? = nil,
    onClose: @escaping () -> Void
  ) {
    self.onClose = onClose

    contentController = MenuBarWebViewController(
      homeURL: url,
      preferredSize: MenuBarConfiguration.floatingNoteSize,
      readySelector: ".floating-note-shell",
      usesWindowChrome: true,
      canShowMenuBar: onShowMenuBar != nil,
      updateChecker: updateChecker
    )
    let window = NSPanel(
      contentRect: NSRect(origin: .zero, size: MenuBarConfiguration.floatingNoteSize),
      styleMask: NativeWindowPolicy.floatingNoteStyleMask,
      backing: .buffered,
      defer: false
    )
    window.title = "Done Log Note"
    window.contentMinSize = MenuBarConfiguration.floatingNoteMinimumSize
    window.contentViewController = contentController
    contentController.onCloseWindow = { [weak window] in
      window?.close()
    }
    window.isReleasedWhenClosed = false
    window.hidesOnDeactivate = false
    window.level = .floating
    window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]

    super.init(window: window)
    NativeWindowPolicy.applyChrome(to: window)
    window.delegate = self
    contentController.onShowMenuBar = onShowMenuBar
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  func show() {
    if let window {
      NativeWindowPolicy.applyChrome(to: window)
      contentController.syncNativeChrome(from: window)
    }
    showWindow(nil)
    if !hasBeenShown {
      window?.center()
      hasBeenShown = true
    }
    window?.makeKeyAndOrderFront(nil)
    NativeAppLaunchPolicy.withReopenIntent(.floatingNoteActivation) {
      NSApp.activate(ignoringOtherApps: true)
    }
  }

  func windowDidResize(_ notification: Notification) {
    guard let window else {
      return
    }
    contentController.syncNativeChrome(from: window)
  }

  func windowWillClose(_ notification: Notification) {
    onClose()
  }
}
