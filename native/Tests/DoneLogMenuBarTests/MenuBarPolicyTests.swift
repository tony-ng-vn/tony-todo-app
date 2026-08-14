import Testing
import WebKit

@testable import DoneLogMenuBar

@Suite("Menu bar web policies")
struct MenuBarPolicyTests {
  private let homeURL = URL(
    string: "https://daymark.inhavens.com/menubar"
  )!

  @Test("Keeps same-origin pages inside the popover")
  func allowsSameOriginNavigation() throws {
    let url = try #require(
      URL(string: "https://daymark.inhavens.com/sign-in")
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
          "https://daymark.inhavens.com/menubar?note=task-123"
      )
    )
    let otherOrigin = try #require(
      URL(string: "https://example.com/menubar?note=task-123")
    )
    let missingTask = try #require(
      URL(string: "https://daymark.inhavens.com/menubar?note=")
    )
    let wrongPath = try #require(
      URL(string: "https://daymark.inhavens.com/?note=task-123")
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

  @Test("Advertises the native updater before the web app loads")
  @MainActor
  func advertisesNativeUpdater() {
    let source = MenuBarWebViewController.nativeHostScriptSource(
      usesWindowChrome: false,
      hasNativeUpdater: true
    )

    #expect(source.contains("window.__doneLogNativeUpdater = true"))
    #expect(source.contains(NativeUpdatePolicy.messageName))
  }

  @Test("Accepts only the quick note return command from the menu bar page")
  func validatesMenuBarReturnCommands() throws {
    let noteURL = try #require(
      URL(string: "https://daymark.inhavens.com/menubar?note=task-123")
    )

    #expect(
      NativeMenuBarReturnPolicy.accepts(
        messageName: NativeMenuBarReturnPolicy.messageName,
        body: ["command": "show"],
        isMainFrame: true,
        sourceURL: noteURL,
        homeURL: homeURL
      )
    )
    #expect(
      !NativeMenuBarReturnPolicy.accepts(
        messageName: NativeMenuBarReturnPolicy.messageName,
        body: ["command": "close"],
        isMainFrame: true,
        sourceURL: noteURL,
        homeURL: homeURL
      )
    )
    #expect(
      !NativeMenuBarReturnPolicy.accepts(
        messageName: NativeMenuBarReturnPolicy.messageName,
        body: ["command": "show"],
        isMainFrame: false,
        sourceURL: noteURL,
        homeURL: homeURL
      )
    )
  }

  @Test("Closes the quick note after showing mini todos")
  func closesQuickNoteAfterShowingMenuBar() {
    var events: [String] = []

    NativeMenuBarReturnPolicy.performReturn(
      showMenuBar: { events.append("show") },
      dismissNote: { events.append("dismiss") }
    )

    #expect(events == ["show", "dismiss"])
  }

  @Test("Lets the quick note header drag the native window")
  @MainActor
  func includesQuickNoteHeaderInNativeDragSelector() {
    let source = MenuBarWebViewController.nativeHostScriptSource(
      usesWindowChrome: true
    )

    #expect(source.contains(".floating-note-header"))
    #expect(source.contains(".floating-note-actions"))
  }

  @Test("Advertises menu bar return only to supported quick notes")
  @MainActor
  func advertisesMenuBarReturnCapability() {
    let supportedSource = MenuBarWebViewController.nativeHostScriptSource(
      usesWindowChrome: true,
      canShowMenuBar: true
    )
    let unsupportedSource = MenuBarWebViewController.nativeHostScriptSource(
      usesWindowChrome: true
    )

    #expect(supportedSource.contains("window.__doneLogCanShowMenuBar = true"))
    #expect(supportedSource.contains(NativeMenuBarReturnPolicy.messageName))
    #expect(unsupportedSource.contains("window.__doneLogCanShowMenuBar = false"))
  }

  @Test("Reports a completed initial load to a late observer")
  @MainActor
  func reportsCompletedLoadToLateObserver() {
    let relay = InitialLoadResultRelay()
    relay.finish(with: .success(()))
    var didReceiveSuccess = false

    relay.observer = { result in
      if case .success = result {
        didReceiveSuccess = true
      }
    }

    #expect(didReceiveSuccess)
  }

  @Test("Requires the expected menu bar shell before reporting ready")
  func requiresExpectedShell() throws {
    let finalURL = try #require(
      URL(string: "https://daymark.inhavens.com/menubar")
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
