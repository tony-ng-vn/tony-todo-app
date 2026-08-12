import Testing
import WebKit

@testable import DoneLogMenuBar

@Suite("Menu bar web policies")
struct MenuBarPolicyTests {
  private let homeURL = URL(
    string: "https://tony-todo-app.vercel.app/menubar"
  )!

  @Test("Keeps same-origin pages inside the popover")
  func allowsSameOriginNavigation() throws {
    let url = try #require(
      URL(string: "https://tony-todo-app.vercel.app/sign-in")
    )

    #expect(
      MenuBarNavigationPolicy.decide(url: url, homeURL: homeURL)
        == .allowInPopover
    )
  }

  @Test("Opens other web origins in the default browser")
  func externalizesOtherWebOrigins() throws {
    let url = try #require(URL(string: "https://example.com/help"))

    #expect(
      MenuBarNavigationPolicy.decide(url: url, homeURL: homeURL)
        == .openExternal
    )
  }

  @Test("Rejects non-web navigation")
  func rejectsNonWebNavigation() throws {
    let url = try #require(URL(string: "file:///tmp/private.txt"))

    #expect(
      MenuBarNavigationPolicy.decide(url: url, homeURL: homeURL) == .cancel
    )
  }

  @Test("Recognizes same-origin floating note pages")
  func recognizesFloatingNotePages() throws {
    let noteURL = try #require(
      URL(
        string:
          "https://tony-todo-app.vercel.app/menubar?note=task-123"
      )
    )
    let otherOrigin = try #require(
      URL(string: "https://example.com/menubar?note=task-123")
    )
    let missingTask = try #require(
      URL(string: "https://tony-todo-app.vercel.app/menubar?note=")
    )
    let wrongPath = try #require(
      URL(string: "https://tony-todo-app.vercel.app/?note=task-123")
    )

    #expect(MenuBarNavigationPolicy.isFloatingNoteURL(noteURL, homeURL: homeURL))
    #expect(!MenuBarNavigationPolicy.isFloatingNoteURL(otherOrigin, homeURL: homeURL))
    #expect(!MenuBarNavigationPolicy.isFloatingNoteURL(missingTask, homeURL: homeURL))
    #expect(!MenuBarNavigationPolicy.isFloatingNoteURL(wrongPath, homeURL: homeURL))
  }

  @Test("Denies media capture")
  func deniesMediaCapture() {
    #expect(MenuBarPermissionPolicy.mediaCaptureDecision == .deny)
  }

  @Test("Requires the expected menu bar shell before reporting ready")
  func requiresExpectedShell() throws {
    let finalURL = try #require(
      URL(string: "https://tony-todo-app.vercel.app/menubar")
    )

    #expect(
      MenuBarLoadPolicy.isReady(
        finalURL: finalURL,
        homeURL: homeURL,
        hasMenuBarShell: true
      )
    )
    #expect(
      !MenuBarLoadPolicy.isReady(
        finalURL: finalURL,
        homeURL: homeURL,
        hasMenuBarShell: false
      )
    )
  }

  @Test("Rejects a shell loaded on another origin")
  func rejectsOtherOriginShell() throws {
    let finalURL = try #require(URL(string: "https://example.com/menubar"))

    #expect(
      !MenuBarLoadPolicy.isReady(
        finalURL: finalURL,
        homeURL: homeURL,
        hasMenuBarShell: true
      )
    )
  }
}
