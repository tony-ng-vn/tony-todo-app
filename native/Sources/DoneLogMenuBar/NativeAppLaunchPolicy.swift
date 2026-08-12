import Foundation

enum NativeAppLaunchPolicy {
  static func shouldOpenFullApp(
    launchDate: Date?,
    environment: [String: String] = ProcessInfo.processInfo.environment
  ) -> Bool {
    guard environment["MENUBAR_NATIVE_SMOKE"] != "1" else {
      return false
    }

    return launchDate != nil
  }
}
