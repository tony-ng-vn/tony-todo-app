import AppKit
import Foundation

enum MenuBarConfiguration {
  static let defaultURL = URL(
    string: "https://tony-todo-app.vercel.app/menubar"
  )!
  static let popoverSize = NSSize(width: 420, height: 640)
  static let fullAppSize = NSSize(width: 1280, height: 820)
  static let fullAppMinimumSize = NSSize(width: 900, height: 600)
  static let floatingNoteSize = NSSize(width: 360, height: 440)
  static let floatingNoteMinimumSize = NSSize(width: 320, height: 400)

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
}
