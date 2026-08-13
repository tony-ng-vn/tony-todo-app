import AppKit

@MainActor
final class FullAppWindowController: NSWindowController, NSWindowDelegate {
  private let application: NSApplication
  private var floatingNoteWindows: [String: FloatingNoteWindowController] = [:]

  init(
    url: URL,
    application: NSApplication = .shared
  ) {
    self.application = application

    let contentController = MenuBarWebViewController(
      homeURL: url,
      preferredSize: MenuBarConfiguration.fullAppSize,
      readySelector: nil,
      usesWindowChrome: true
    )
    let window = NSWindow(
      contentRect: NSRect(origin: .zero, size: MenuBarConfiguration.fullAppSize),
      styleMask: NativeWindowPolicy.primaryStyleMask,
      backing: .buffered,
      defer: false
    )
    window.title = "Done Log"
    window.contentMinSize = MenuBarConfiguration.fullAppMinimumSize
    window.contentViewController = contentController
    window.isReleasedWhenClosed = false
    window.collectionBehavior = [.fullScreenPrimary, .moveToActiveSpace]

    let frameName = "com.tonynguyen.donelog.main-window"
    if !window.setFrameUsingName(frameName) {
      window.center()
    }
    window.setFrameAutosaveName(frameName)

    super.init(window: window)
    NativeWindowPolicy.applyChrome(to: window)
    window.delegate = self

    contentController.onOpenFloatingNote = { [weak self] noteURL in
      self?.openFloatingNote(noteURL)
    }
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  func show() {
    application.setActivationPolicy(.regular)
    if let window {
      NativeWindowPolicy.applyChrome(to: window)
    }
    if window?.isMiniaturized == true {
      window?.deminiaturize(nil)
    }
    showWindow(nil)
    window?.makeKeyAndOrderFront(nil)
    application.activate(ignoringOtherApps: true)
  }

  func windowWillClose(_ notification: Notification) {
    application.setActivationPolicy(.accessory)
  }

  func windowWillUseStandardFrame(
    _ window: NSWindow,
    defaultFrame newFrame: NSRect
  ) -> NSRect {
    NativeWindowPolicy.standardFrame(
      defaultFrame: newFrame,
      screenVisibleFrame: window.screen?.visibleFrame
    )
  }

  private func openFloatingNote(_ url: URL) {
    let key = url.absoluteString
    if let existingWindow = floatingNoteWindows[key] {
      existingWindow.show()
      return
    }

    let controller = FloatingNoteWindowController(url: url) { [weak self] in
      self?.floatingNoteWindows[key] = nil
    }
    floatingNoteWindows[key] = controller
    controller.show()
  }
}
