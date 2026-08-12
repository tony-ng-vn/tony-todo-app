import AppKit
import Testing

@testable import DoneLogMenuBar

@Suite("Application menu")
struct ApplicationMenuTests {
  @Test("Provides standard editing shortcuts to the web view")
  @MainActor
  func providesEditingShortcuts() throws {
    let windowCommands = NativeWindowCommandHandler()
    let mainMenu = ApplicationMenuFactory.makeMainMenu(
      windowCommands: windowCommands
    )
    let applicationMenu = try #require(
      mainMenu.items.first { $0.submenu?.title == "Done Log" }?.submenu
    )
    let fileMenu = try #require(mainMenu.items.first { $0.title == "File" }?.submenu)
    let editMenu = try #require(mainMenu.items.first { $0.title == "Edit" }?.submenu)
    let viewMenu = try #require(mainMenu.items.first { $0.title == "View" }?.submenu)

    #expect(applicationMenu.item(withTitle: "About Done Log") != nil)
    #expect(applicationMenu.item(withTitle: "Hide Done Log")?.keyEquivalent == "h")
    #expect(applicationMenu.item(withTitle: "Quit Done Log")?.keyEquivalent == "q")
    let closeItem = try #require(fileMenu.item(withTitle: "Close Window"))
    #expect(closeItem.keyEquivalent == "w")
    #expect(closeItem.target === windowCommands)

    #expect(editMenu.item(withTitle: "Undo")?.keyEquivalent == "z")
    #expect(editMenu.item(withTitle: "Redo")?.keyEquivalent == "Z")
    #expect(editMenu.item(withTitle: "Cut")?.keyEquivalent == "x")
    #expect(editMenu.item(withTitle: "Copy")?.keyEquivalent == "c")
    #expect(editMenu.item(withTitle: "Paste")?.keyEquivalent == "v")
    #expect(editMenu.item(withTitle: "Select All")?.keyEquivalent == "a")
    #expect(editMenu.item(withTitle: "Paste")?.action == #selector(NSText.paste(_:)))
    let fullScreenItem = try #require(viewMenu.item(withTitle: "Enter Full Screen"))
    #expect(fullScreenItem.keyEquivalent == "f")
    #expect(fullScreenItem.keyEquivalentModifierMask == [.control, .command])
    #expect(fullScreenItem.target === windowCommands)
    let windowMenu = try #require(mainMenu.items.first { $0.title == "Window" }?.submenu)
    let minimizeItem = try #require(windowMenu.item(withTitle: "Minimize"))
    let zoomItem = try #require(windowMenu.item(withTitle: "Zoom"))
    #expect(minimizeItem.keyEquivalent == "m")
    #expect(minimizeItem.target === windowCommands)
    #expect(zoomItem.target === windowCommands)
    #expect(windowMenu.item(withTitle: "Bring All to Front") != nil)
  }
}
