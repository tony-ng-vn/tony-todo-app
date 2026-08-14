import AppKit
import Foundation

enum MenuBarConfiguration {
  static let defaultURL = URL(
    string: "https://daymark.inhavens.com/menubar"
  )!
  static let popoverSize = NSSize(width: 420, height: 640)
  static let fullAppSize = NSSize(width: 1280, height: 820)
  static let fullAppMinimumSize = NSSize(width: 900, height: 600)
  static let floatingNoteSize = NSSize(width: 360, height: 440)
  static let floatingNoteMinimumSize = NSSize(width: 320, height: 400)

  static func statusItemAutosaveName(bundleIdentifier: String?) -> String? {
    guard let bundleIdentifier, !bundleIdentifier.isEmpty else {
      return nil
    }

    return "\(bundleIdentifier).primary-status-item-v4"
  }

  static func shouldRefreshWebContentForPresentation(
    currentURL: URL?,
    isLoading: Bool,
    windowWasVisible: Bool
  ) -> Bool {
    currentURL != nil && !isLoading && !windowWasVisible
  }

  static func resolveURL(
    environment: [String: String] = ProcessInfo.processInfo.environment
  ) -> URL {
    guard
      let override = environment["DONE_LOG_MENUBAR_URL"],
      let url = URL(string: override),
      let scheme = url.scheme?.lowercased(),
      scheme == "http" || scheme == "https",
      url.host != nil
    else {
      return defaultURL
    }

    return url
  }

  static func fullAppURL(for menuBarURL: URL) -> URL {
    URL(string: "/", relativeTo: menuBarURL)?.absoluteURL
      ?? URL(string: "/", relativeTo: defaultURL)!.absoluteURL
  }

  static func makeHomeRequest(for url: URL) -> URLRequest {
    URLRequest(
      url: url,
      cachePolicy: .reloadRevalidatingCacheData,
      timeoutInterval: 30
    )
  }

  static func statusItemFrameIsInMenuBar(
    _ statusItemFrame: NSRect,
    usableAreas: [NSRect]
  ) -> Bool {
    !statusItemFrame.isEmpty && usableAreas.contains { area in
      !area.isEmpty
        && area.contains(statusItemFrame)
        && statusItemFrame.maxX < area.maxX - 2
    }
  }

  @MainActor
  static func menuBarUsableAreas(for screen: NSScreen) -> [NSRect] {
    let candidateAreas: [NSRect?] = [
      screen.auxiliaryTopLeftArea,
      screen.auxiliaryTopRightArea,
    ]
    let auxiliaryAreas = candidateAreas.compactMap { area -> NSRect? in
      guard let area, !area.isEmpty else {
        return nil
      }
      return area
    }

    if !auxiliaryAreas.isEmpty {
      return auxiliaryAreas
    }

    return [
      NSRect(
        x: screen.frame.minX,
        y: screen.visibleFrame.maxY,
        width: screen.frame.width,
        height: screen.frame.maxY - screen.visibleFrame.maxY
      )
    ]
  }

  @MainActor
  static func makeStatusIcon() -> NSImage? {
    guard
      let image = NSImage(
        systemSymbolName: "checkmark.circle",
        accessibilityDescription: "Done Log"
      )
    else {
      return nil
    }

    image.isTemplate = true
    image.size = NSSize(width: 16, height: 16)
    return image
  }

  @MainActor
  static func makeStatusItem() -> NSStatusItem {
    let statusItem = NSStatusBar.system.statusItem(
      withLength: NSStatusItem.squareLength
    )
    if let autosaveName = statusItemAutosaveName(
      bundleIdentifier: Bundle.main.bundleIdentifier
    ) {
      statusItem.autosaveName = autosaveName
    }
    if let button = statusItem.button {
      button.image = makeStatusIcon()
      button.imagePosition = .imageOnly
      button.toolTip = "Done Log"
    }
    statusItem.isVisible = true
    return statusItem
  }
}
