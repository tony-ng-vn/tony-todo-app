import AppKit

@MainActor
final class FloatingNoteWindowController: NSWindowController, NSWindowDelegate {
  private let onClose: () -> Void
  private var hasBeenShown = false

  init(url: URL, onClose: @escaping () -> Void) {
    self.onClose = onClose

    let contentController = MenuBarWebViewController(
      homeURL: url,
      preferredSize: MenuBarConfiguration.floatingNoteSize,
      readySelector: ".floating-note-shell"
    )
    let window = NSPanel(
      contentRect: NSRect(origin: .zero, size: MenuBarConfiguration.floatingNoteSize),
      styleMask: [.titled, .closable, .miniaturizable, .resizable, .utilityWindow],
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
    window.isMovableByWindowBackground = true
    window.level = .floating
    window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]

    super.init(window: window)
    window.delegate = self
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  func show() {
    showWindow(nil)
    if !hasBeenShown {
      window?.center()
      hasBeenShown = true
    }
    window?.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
  }

  func windowWillClose(_ notification: Notification) {
    onClose()
  }
}
