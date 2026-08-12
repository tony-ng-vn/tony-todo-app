import AppKit
import Testing

@testable import DoneLogMenuBar

@Suite("Menu bar configuration")
struct MenuBarConfigurationTests {
  @Test("Uses the deployed menu bar route by default")
  func usesDeployedRouteByDefault() {
    #expect(
      MenuBarConfiguration.resolveURL(environment: [:]).absoluteString
        == "https://tony-todo-app.vercel.app/menubar"
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
      URL(string: "https://tony-todo-app.vercel.app/menubar")
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
      ).absoluteString == "https://tony-todo-app.vercel.app/menubar"
    )
  }

  @Test("Builds a visible native template icon")
  @MainActor
  func buildsNativeTemplateIcon() throws {
    let icon = try #require(MenuBarConfiguration.makeStatusIcon())

    #expect(icon.isTemplate)
    #expect(icon.size == NSSize(width: 16, height: 16))
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
        NSRect(x: 1762, y: 1147, width: 38, height: 22),
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
