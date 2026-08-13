import Darwin
import Foundation

final class SingleInstanceLock {
  static let defaultURL = FileManager.default.temporaryDirectory
    .appendingPathComponent("com.tonynguyen.done-log-menubar.lock")
  static let smokeURL = FileManager.default.temporaryDirectory
    .appendingPathComponent("com.tonynguyen.done-log-menubar.smoke.lock")

  private let fileDescriptor: Int32

  private init(fileDescriptor: Int32) {
    self.fileDescriptor = fileDescriptor
  }

  static func acquire(at url: URL = defaultURL) -> SingleInstanceLock? {
    let fileDescriptor = open(
      url.path,
      O_CREAT | O_RDWR,
      S_IRUSR | S_IWUSR
    )
    guard fileDescriptor >= 0 else {
      return nil
    }

    guard flock(fileDescriptor, LOCK_EX | LOCK_NB) == 0 else {
      close(fileDescriptor)
      return nil
    }

    return SingleInstanceLock(fileDescriptor: fileDescriptor)
  }

  deinit {
    flock(fileDescriptor, LOCK_UN)
    close(fileDescriptor)
  }
}

extension Notification.Name {
  static let doneLogShowFullApp = Notification.Name(
    "com.tonynguyen.done-log-menubar.show-full-app"
  )
  static let doneLogQuit = Notification.Name(
    "com.tonynguyen.done-log-menubar.quit"
  )
}

enum MenuBarInstanceKind: Equatable {
  case production
  case development
  case smoke
}

enum MenuBarLaunchPolicy {
  static func instanceKind(
    environment: [String: String] = ProcessInfo.processInfo.environment
  ) -> MenuBarInstanceKind {
    if environment["MENUBAR_NATIVE_SMOKE"] == "1" {
      return .smoke
    }
    if environment["DONE_LOG_INSTANCE"] == "dev" {
      return .development
    }
    return .production
  }

  static func sanitizedInstanceID(_ raw: String?) -> String {
    let allowed = CharacterSet.alphanumerics
    let filtered = (raw ?? "dev").unicodeScalars.filter { allowed.contains($0) }
    let value = String(String.UnicodeScalarView(filtered))
    if value.isEmpty {
      return "dev"
    }
    return String(value.prefix(32))
  }

  static func lockURL(
    environment: [String: String] = ProcessInfo.processInfo.environment
  ) -> URL {
    switch instanceKind(environment: environment) {
    case .smoke:
      return SingleInstanceLock.smokeURL
    case .development:
      let instanceID = sanitizedInstanceID(environment["DONE_LOG_INSTANCE_ID"])
      return FileManager.default.temporaryDirectory
        .appendingPathComponent(
          "com.tonynguyen.done-log-menubar.dev.\(instanceID).lock"
        )
    case .production:
      return SingleInstanceLock.defaultURL
    }
  }

  static func showFullAppNotification(
    environment: [String: String] = ProcessInfo.processInfo.environment
  ) -> Notification.Name {
    switch instanceKind(environment: environment) {
    case .production:
      return .doneLogShowFullApp
    case .development:
      let instanceID = sanitizedInstanceID(environment["DONE_LOG_INSTANCE_ID"])
      return Notification.Name(
        "com.tonynguyen.done-log-menubar.dev.\(instanceID).show-full-app"
      )
    case .smoke:
      return Notification.Name(
        "com.tonynguyen.done-log-menubar.smoke.show-full-app"
      )
    }
  }

  static func quitNotification(
    environment: [String: String] = ProcessInfo.processInfo.environment
  ) -> Notification.Name {
    switch instanceKind(environment: environment) {
    case .production:
      return .doneLogQuit
    case .development:
      let instanceID = sanitizedInstanceID(environment["DONE_LOG_INSTANCE_ID"])
      return Notification.Name(
        "com.tonynguyen.done-log-menubar.dev.\(instanceID).quit"
      )
    case .smoke:
      return Notification.Name(
        "com.tonynguyen.done-log-menubar.smoke.quit"
      )
    }
  }

  static func lockContentionNotification(
    environment: [String: String] = ProcessInfo.processInfo.environment
  ) -> Notification.Name? {
    switch instanceKind(environment: environment) {
    case .smoke:
      return nil
    case .production, .development:
      return showFullAppNotification(environment: environment)
    }
  }

  static func lockContentionExitCode(
    environment: [String: String] = ProcessInfo.processInfo.environment
  ) -> Int32 {
    instanceKind(environment: environment) == .smoke ? 1 : 0
  }

  static func lockContentionNotification(
    isSmokeCheck: Bool
  ) -> Notification.Name? {
    lockContentionNotification(
      environment: isSmokeCheck ? ["MENUBAR_NATIVE_SMOKE": "1"] : [:]
    )
  }

  static func lockContentionExitCode(isSmokeCheck: Bool) -> Int32 {
    lockContentionExitCode(
      environment: isSmokeCheck ? ["MENUBAR_NATIVE_SMOKE": "1"] : [:]
    )
  }
}
