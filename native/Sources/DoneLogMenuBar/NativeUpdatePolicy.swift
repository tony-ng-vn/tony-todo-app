import Foundation

enum NativeUpdateCommand: Equatable {
  case check
}

@MainActor
@objc protocol AppUpdateChecking: AnyObject {
  func checkForUpdates(_ sender: Any?)
}

enum NativeUpdatePolicy {
  static let messageName = "doneLogUpdater"
  static let bootstrapDownloadURL = URL(
    string:
      "https://github.com/tony-ng-vn/tony-todo-app/releases/latest/download/Done-Log.dmg"
  )!

  static func command(from body: Any) -> NativeUpdateCommand? {
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

    return command == "check" ? .check : nil
  }

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
      MenuBarNavigationPolicy.decide(url: sourceURL, homeURL: homeURL)
        == .allowInPopover
    else {
      return false
    }

    return command(from: body) == .check
  }
}
