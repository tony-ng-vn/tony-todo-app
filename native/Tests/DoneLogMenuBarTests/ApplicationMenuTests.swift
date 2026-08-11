import AppKit
import Testing

@testable import DoneLogMenuBar

@Suite("Application menu")
struct ApplicationMenuTests {
  @Test("Provides standard editing shortcuts to the web view")
  @MainActor
  func providesEditingShortcuts() throws {
    let mainMenu = ApplicationMenuFactory.makeMainMenu()
    let editMenu = try #require(mainMenu.items.first { $0.title == "Edit" }?.submenu)

    #expect(editMenu.item(withTitle: "Cut")?.keyEquivalent == "x")
    #expect(editMenu.item(withTitle: "Copy")?.keyEquivalent == "c")
    #expect(editMenu.item(withTitle: "Paste")?.keyEquivalent == "v")
    #expect(editMenu.item(withTitle: "Select All")?.keyEquivalent == "a")
    #expect(editMenu.item(withTitle: "Paste")?.action == #selector(NSText.paste(_:)))
  }
}
