import AppKit

@MainActor
final class MenuBarController: NSObject {
  private let statusItem: NSStatusItem
  private let popover: NSPopover
  private let contextMenu: NSMenu
  private let fullAppURL: URL
  private let webViewController: MenuBarWebViewController

  init(url: URL) {
    statusItem = NSStatusBar.system.statusItem(
      withLength: NSStatusItem.variableLength
    )
    popover = NSPopover()
    contextMenu = NSMenu()
    fullAppURL = MenuBarConfiguration.fullAppURL(for: url)
    webViewController = MenuBarWebViewController(homeURL: url)
    super.init()

    configurePopover()
    configureContextMenu()
    configureStatusItem()
  }

  var isReady: Bool {
    statusItem.button?.image != nil && statusItem.button?.window != nil
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
    _ = webViewController.view
  }

  private func configureContextMenu() {
    let openItem = NSMenuItem(
      title: "Open Done Log",
      action: #selector(openFullApp),
      keyEquivalent: ""
    )
    openItem.target = self
    contextMenu.addItem(openItem)
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
      selector: #selector(showPopoverFromNotification),
      name: .doneLogShowPopover,
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

  @objc
  private func showPopoverFromNotification() {
    showPopover()
  }

  private func showContextMenu() {
    guard let button = statusItem.button else {
      return
    }

    statusItem.menu = contextMenu
    button.performClick(nil)
    statusItem.menu = nil
  }

  @objc
  private func openFullApp() {
    NSWorkspace.shared.open(fullAppURL)
  }

  @objc
  private func quit() {
    NSApp.terminate(nil)
  }
}
