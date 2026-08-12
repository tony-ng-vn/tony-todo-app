import AppKit

enum ApplicationMenuFactory {
  @MainActor
  static func makeMainMenu(
    windowCommands: NativeWindowCommandHandler
  ) -> NSMenu {
    let mainMenu = NSMenu()

    let applicationItem = NSMenuItem()
    mainMenu.addItem(applicationItem)
    let applicationMenu = NSMenu(title: "Done Log")
    applicationMenu.addItem(
      withTitle: "About Done Log",
      action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)),
      keyEquivalent: ""
    )
    applicationMenu.addItem(.separator())
    applicationMenu.addItem(
      withTitle: "Hide Done Log",
      action: #selector(NSApplication.hide(_:)),
      keyEquivalent: "h"
    )
    let hideOthersItem = applicationMenu.addItem(
      withTitle: "Hide Others",
      action: #selector(NSApplication.hideOtherApplications(_:)),
      keyEquivalent: "h"
    )
    hideOthersItem.keyEquivalentModifierMask = [.command, .option]
    applicationMenu.addItem(
      withTitle: "Show All",
      action: #selector(NSApplication.unhideAllApplications(_:)),
      keyEquivalent: ""
    )
    applicationMenu.addItem(.separator())
    applicationMenu.addItem(
      withTitle: "Quit Done Log",
      action: #selector(NSApplication.terminate(_:)),
      keyEquivalent: "q"
    )
    applicationItem.submenu = applicationMenu

    let fileItem = NSMenuItem(title: "File", action: nil, keyEquivalent: "")
    mainMenu.addItem(fileItem)
    let fileMenu = NSMenu(title: "File")
    let closeItem = fileMenu.addItem(
      withTitle: "Close Window",
      action: #selector(NativeWindowCommandHandler.closeWindow(_:)),
      keyEquivalent: "w"
    )
    closeItem.target = windowCommands
    fileItem.submenu = fileMenu

    let editItem = NSMenuItem(title: "Edit", action: nil, keyEquivalent: "")
    mainMenu.addItem(editItem)
    let editMenu = NSMenu(title: "Edit")
    editMenu.addItem(
      withTitle: "Undo",
      action: Selector(("undo:")),
      keyEquivalent: "z"
    )
    editMenu.addItem(
      withTitle: "Redo",
      action: Selector(("redo:")),
      keyEquivalent: "Z"
    )
    editMenu.addItem(.separator())
    editMenu.addItem(
      withTitle: "Cut",
      action: #selector(NSText.cut(_:)),
      keyEquivalent: "x"
    )
    editMenu.addItem(
      withTitle: "Copy",
      action: #selector(NSText.copy(_:)),
      keyEquivalent: "c"
    )
    editMenu.addItem(
      withTitle: "Paste",
      action: #selector(NSText.paste(_:)),
      keyEquivalent: "v"
    )
    editMenu.addItem(
      withTitle: "Select All",
      action: #selector(NSText.selectAll(_:)),
      keyEquivalent: "a"
    )
    editItem.submenu = editMenu

    let viewItem = NSMenuItem(title: "View", action: nil, keyEquivalent: "")
    mainMenu.addItem(viewItem)
    let viewMenu = NSMenu(title: "View")
    let fullScreenItem = viewMenu.addItem(
      withTitle: "Enter Full Screen",
      action: #selector(NativeWindowCommandHandler.toggleFullScreen(_:)),
      keyEquivalent: "f"
    )
    fullScreenItem.keyEquivalentModifierMask = [.control, .command]
    fullScreenItem.target = windowCommands
    viewItem.submenu = viewMenu

    let windowItem = NSMenuItem(title: "Window", action: nil, keyEquivalent: "")
    mainMenu.addItem(windowItem)
    let windowMenu = NSMenu(title: "Window")
    let minimizeItem = windowMenu.addItem(
      withTitle: "Minimize",
      action: #selector(NativeWindowCommandHandler.minimizeWindow(_:)),
      keyEquivalent: "m"
    )
    minimizeItem.target = windowCommands
    let zoomItem = windowMenu.addItem(
      withTitle: "Zoom",
      action: #selector(NativeWindowCommandHandler.zoomWindow(_:)),
      keyEquivalent: ""
    )
    zoomItem.target = windowCommands
    windowMenu.addItem(.separator())
    let bringAllToFrontItem = windowMenu.addItem(
      withTitle: "Bring All to Front",
      action: #selector(NativeWindowCommandHandler.bringAllToFront(_:)),
      keyEquivalent: ""
    )
    bringAllToFrontItem.target = windowCommands
    windowItem.submenu = windowMenu

    return mainMenu
  }
}
