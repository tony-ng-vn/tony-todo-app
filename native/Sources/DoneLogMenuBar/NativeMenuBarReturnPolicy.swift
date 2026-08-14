import Foundation

enum NativeMenuBarReturnPolicy {
  static let messageName = "doneLogMenuBar"

  static func accepts(
    messageName: String,
    body: Any,
    isMainFrame: Bool,
    sourceURL: URL?,
    homeURL: URL
  ) -> Bool {
    guard messageName == Self.messageName,
      isMainFrame,
      let sourceURL,
      MenuBarNavigationPolicy.isFloatingNoteURL(sourceURL, homeURL: homeURL)
    else {
      return false
    }

    let command: String?
    if let payload = body as? [String: String] {
      command = payload["command"]
    } else if let payload = body as? [String: Any] {
      command = payload["command"] as? String
    } else if let payload = body as? NSDictionary {
      command = payload["command"] as? String
    } else {
      command = nil
    }

    return command == "show"
  }

  static func performReturn(showMenuBar: () -> Void, dismissNote: () -> Void) {
    showMenuBar()
    dismissNote()
  }
}
