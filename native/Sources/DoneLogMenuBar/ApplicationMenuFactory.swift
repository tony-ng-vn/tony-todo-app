import AppKit

enum ApplicationMenuFactory {
  @MainActor
  static func makeMainMenu() -> NSMenu {
    let mainMenu = NSMenu()

    let applicationItem = NSMenuItem()
    mainMenu.addItem(applicationItem)
    let applicationMenu = NSMenu(title: "Done Log")
    applicationMenu.addItem(
      withTitle: "Quit Done Log",
      action: #selector(NSApplication.terminate(_:)),
      keyEquivalent: "q"
    )
    applicationItem.submenu = applicationMenu

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

    let windowItem = NSMenuItem(title: "Window", action: nil, keyEquivalent: "")
    mainMenu.addItem(windowItem)
    let windowMenu = NSMenu(title: "Window")
    windowMenu.addItem(
      withTitle: "Close Window",
      action: #selector(NSWindow.performClose(_:)),
      keyEquivalent: "w"
    )
    windowItem.submenu = windowMenu

    return mainMenu
  }
}
