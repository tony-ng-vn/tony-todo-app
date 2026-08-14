import AppKit
import Testing

@testable import DoneLogMenuBar

@Suite("Menu bar configuration")
struct MenuBarConfigurationTests {
  @Test("Uses the deployed menu bar route by default")
  func usesDeployedRouteByDefault() {
    #expect(
      MenuBarConfiguration.resolveURL(environment: [:]).absoluteString
        == "https://daymark.inhavens.com/menubar"
    )
  }

  @Test("Accepts a local web route")
  func acceptsLocalWebRoute() {
    let environment = [
      "DONE_LOG_MENUBAR_URL": "http://127.0.0.1:5176/menubar?local=1"
    ]

    #expect(
      MenuBarConfiguration.resolveURL(environment: environment).absoluteString
        == "http://127.0.0.1:5176/menubar?local=1"
    )
  }

  @Test("Revalidates the menu bar page on launch")
  func revalidatesMenuBarPageOnLaunch() throws {
    let url = try #require(
      URL(string: "https://daymark.inhavens.com/menubar")
    )
    let request = MenuBarConfiguration.makeHomeRequest(for: url)

    #expect(request.url == url)
    #expect(request.cachePolicy == .reloadRevalidatingCacheData)
  }

  @Test("Opens the full app on the same origin as the menu bar route")
  func opensFullAppOnSameOrigin() throws {
    let menuBarURL = try #require(
      URL(string: "http://127.0.0.1:5176/menubar?local=1")
    )

    #expect(
      MenuBarConfiguration.fullAppURL(for: menuBarURL).absoluteString
        == "http://127.0.0.1:5176/"
    )
  }

  @Test(
    "Rejects unsafe route overrides",
    arguments: [
      "file:///tmp/menubar.html",
      "javascript:alert(1)",
      "not a URL",
    ]
  )
  func rejectsUnsafeRouteOverride(override: String) {
    #expect(
      MenuBarConfiguration.resolveURL(
        environment: ["DONE_LOG_MENUBAR_URL": override]
      ).absoluteString == "https://daymark.inhavens.com/menubar"
    )
  }

  @Test("Uses the status item identity exposed in System Settings")
  func usesSystemSettingsStatusItemIdentity() {
    #expect(
      MenuBarConfiguration.statusItemAutosaveName(
        bundleIdentifier: "com.tonynguyen.donelog"
      ) == "com.tonynguyen.donelog.primary-status-item-v4"
    )
  }

  @Test(
    "Refreshes an existing document when the full app is presented",
    arguments: [
      (URL(string: "https://daymark.inhavens.com/")!, false, false, true),
      (URL(string: "https://daymark.inhavens.com/")!, false, true, false),
      (URL(string: "https://daymark.inhavens.com/")!, true, false, false),
      (nil, false, false, false),
    ]
  )
  func refreshesExistingDocumentForPresentation(
    currentURL: URL?,
    isLoading: Bool,
    windowWasVisible: Bool,
    expected: Bool
  ) {
    #expect(
      MenuBarConfiguration.shouldRefreshWebContentForPresentation(
        currentURL: currentURL,
        isLoading: isLoading,
        windowWasVisible: windowWasVisible
      ) == expected
    )
  }

  @Test("Builds a visible native template icon")
  @MainActor
  func buildsNativeTemplateIcon() throws {
    let icon = try #require(MenuBarConfiguration.makeStatusIcon())

    #expect(icon.isTemplate)
    #expect(icon.size == NSSize(width: 16, height: 16))
  }

  @Test("Leaves native layout styling in the shared stylesheet")
  @MainActor
  func doesNotInjectNativeLayoutCSS() {
    let source = MenuBarWebViewController.nativeHostScriptSource(
      usesWindowChrome: true
    )

    #expect(source.contains("classList.add('is-native-host')"))
    #expect(source.contains("--native-titlebar-inset"))
    #expect(source.contains("--native-traffic-lights-inset"))
    #expect(!source.contains("createElement('style')"))
    #expect(!source.contains("padding-top"))
  }

  @Test("Rejects an offscreen status item as ready")
  func rejectsOffscreenStatusItem() {
    #expect(
      !MenuBarConfiguration.statusItemFrameIsInMenuBar(
        NSRect(x: 0, y: -3, width: 38, height: 22),
        usableAreas: [NSRect(x: 1000, y: 1130, width: 800, height: 39)]
      )
    )
  }

  @Test("Accepts a status item inside the menu bar")
  func acceptsVisibleStatusItem() {
    #expect(
      MenuBarConfiguration.statusItemFrameIsInMenuBar(
        NSRect(x: 1378, y: 1147, width: 34, height: 22),
        usableAreas: [NSRect(x: 1000, y: 1130, width: 800, height: 39)]
      )
    )
  }

  @Test("Rejects a status item parked on the trailing screen edge")
  func rejectsTrailingEdgeStatusItem() {
    #expect(
      !MenuBarConfiguration.statusItemFrameIsInMenuBar(
        NSRect(x: 1767, y: 1147, width: 33, height: 22),
        usableAreas: [NSRect(x: 1000, y: 1130, width: 800, height: 39)]
      )
    )
  }

  @Test("Rejects a partially offscreen status item")
  func rejectsPartiallyOffscreenStatusItem() {
    #expect(
      !MenuBarConfiguration.statusItemFrameIsInMenuBar(
        NSRect(x: 1780, y: 1147, width: 38, height: 22),
        usableAreas: [NSRect(x: 1000, y: 1130, width: 800, height: 39)]
      )
    )
  }

  @Test("Rejects a status item under the camera housing")
  func rejectsStatusItemUnderCameraHousing() {
    #expect(
      !MenuBarConfiguration.statusItemFrameIsInMenuBar(
        NSRect(x: 880, y: 1130, width: 38, height: 39),
        usableAreas: [
          NSRect(x: 0, y: 1130, width: 800, height: 39),
          NSRect(x: 1000, y: 1130, width: 800, height: 39),
        ]
      )
    )
  }
}
