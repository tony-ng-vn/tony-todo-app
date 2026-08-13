import AppKit

@MainActor
final class MenuBarController: NSObject {
  private let statusItem: NSStatusItem
  private let popover: NSPopover
  private let contextMenu: NSMenu
  private let fullAppWindowController: FullAppWindowController
  private let webViewController: MenuBarWebViewController
  private let updateChecker: any AppUpdateChecking
  private let loginItemManager: LoginItemManager
  private let launchAtLoginItem: NSMenuItem
  private var floatingNoteWindows: [String: FloatingNoteWindowController] = [:]

  init(url: URL, updateChecker: any AppUpdateChecking) {
    statusItem = NSStatusBar.system.statusItem(
      withLength: NSStatusItem.squareLength
    )
    popover = NSPopover()
    contextMenu = NSMenu()
    fullAppWindowController = FullAppWindowController(
      url: MenuBarConfiguration.fullAppURL(for: url),
      updateChecker: updateChecker
    )
    webViewController = MenuBarWebViewController(
      homeURL: url,
      updateChecker: updateChecker
    )
    self.updateChecker = updateChecker
    loginItemManager = LoginItemManager()
    launchAtLoginItem = NSMenuItem()
    super.init()

    configurePopover()
    configureContextMenu()
    configureStatusItem()
  }

  var isReady: Bool {
    guard
      statusItem.isVisible,
      statusItem.button?.image != nil,
      let statusItemWindow = statusItem.button?.window,
      statusItemWindow.isVisible
    else {
      return false
    }

    return NSScreen.screens.contains { screen in
      MenuBarConfiguration.statusItemFrameIsInMenuBar(
        statusItemWindow.frame,
        usableAreas: MenuBarConfiguration.menuBarUsableAreas(for: screen)
      )
    }
  }

  var onLoadResult: ((Result<Void, Error>) -> Void)? {
    get {
      webViewController.onLoadResult
    }
    set {
      webViewController.onLoadResult = newValue
    }
  }

  private func configurePopover() {
    popover.behavior = .transient
    popover.animates = true
    popover.contentSize = MenuBarConfiguration.popoverSize
    popover.contentViewController = webViewController
    webViewController.onOpenFloatingNote = { [weak self] url in
      self?.openFloatingNote(url)
    }
    _ = webViewController.view
  }

  private func openFloatingNote(_ url: URL) {
    let key = url.absoluteString
    if let existingWindow = floatingNoteWindows[key] {
      existingWindow.show()
      return
    }

    let controller = FloatingNoteWindowController(
      url: url,
      updateChecker: updateChecker
    ) { [weak self] in
      self?.floatingNoteWindows[key] = nil
    }
    floatingNoteWindows[key] = controller
    controller.show()
  }

  private func configureContextMenu() {
    let openItem = NSMenuItem(
      title: "Open Done Log",
      action: #selector(showFullApp),
      keyEquivalent: ""
    )
    openItem.target = self
    contextMenu.addItem(openItem)
    contextMenu.addItem(.separator())

    launchAtLoginItem.title = "Launch at Login"
    launchAtLoginItem.action = #selector(toggleLaunchAtLogin)
    launchAtLoginItem.target = self
    contextMenu.addItem(launchAtLoginItem)
    contextMenu.addItem(.separator())

    let quitItem = NSMenuItem(
      title: "Quit",
      action: #selector(quit),
      keyEquivalent: "q"
    )
    quitItem.target = self
    contextMenu.addItem(quitItem)
  }

  private func configureStatusItem() {
    statusItem.autosaveName = "com.tonynguyen.donelog.primary-status-item"
    statusItem.isVisible = true

    guard let button = statusItem.button else {
      return
    }

    button.image = MenuBarConfiguration.makeStatusIcon()
    button.imagePosition = .imageOnly
    button.toolTip = "Done Log"
    button.target = self
    button.action = #selector(statusItemClicked)
    button.sendAction(on: [.leftMouseUp, .rightMouseUp])

    DistributedNotificationCenter.default().addObserver(
      self,
      selector: #selector(showFullApp),
      name: MenuBarLaunchPolicy.showFullAppNotification(),
      object: nil
    )
    DistributedNotificationCenter.default().addObserver(
      self,
      selector: #selector(quit),
      name: MenuBarLaunchPolicy.quitNotification(),
      object: nil
    )
  }

  @objc
  private func statusItemClicked() {
    guard let event = NSApp.currentEvent else {
      return
    }

    if event.type == .rightMouseUp {
      showContextMenu()
    } else {
      togglePopover()
    }
  }

  private func togglePopover() {
    if popover.isShown {
      popover.performClose(nil)
      return
    }

    showPopover()
  }

  private func showPopover() {
    guard let button = statusItem.button else {
      return
    }

    popover.show(
      relativeTo: button.bounds,
      of: button,
      preferredEdge: .minY
    )
    popover.contentViewController?.view.window?.makeKey()
  }

  private func showContextMenu() {
    guard let button = statusItem.button else {
      return
    }

    updateLaunchAtLoginItem()
    statusItem.menu = contextMenu
    button.performClick(nil)
    statusItem.menu = nil
  }

  private func updateLaunchAtLoginItem() {
    guard loginItemManager.isAvailable else {
      launchAtLoginItem.title = "Launch at Login (Install app first)"
      launchAtLoginItem.state = .off
      launchAtLoginItem.isEnabled = false
      return
    }

    launchAtLoginItem.isEnabled = true
    switch LoginItemPolicy.indicator(for: loginItemManager.status) {
    case .off:
      launchAtLoginItem.title = "Launch at Login"
      launchAtLoginItem.state = .off
    case .on:
      launchAtLoginItem.title = "Launch at Login"
      launchAtLoginItem.state = .on
    case .requiresApproval:
      launchAtLoginItem.title = "Launch at Login (Approval Required)"
      launchAtLoginItem.state = .mixed
    }
  }

  @objc
  private func toggleLaunchAtLogin() {
    do {
      try loginItemManager.performMenuAction()
      updateLaunchAtLoginItem()
    } catch {
      showLoginItemError(error)
    }
  }

  private func showLoginItemError(_ error: Error) {
    NSApp.activate(ignoringOtherApps: true)
    let alert = NSAlert()
    alert.alertStyle = .warning
    alert.messageText = "Could not update Launch at Login"
    alert.informativeText = error.localizedDescription
    alert.addButton(withTitle: "OK")
    alert.runModal()
  }

  @objc
  func showFullApp() {
    fullAppWindowController.show()
  }

  @objc
  private func quit() {
    NSApp.terminate(nil)
  }
}
