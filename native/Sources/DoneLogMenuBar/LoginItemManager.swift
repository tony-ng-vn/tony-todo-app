import Foundation
import ServiceManagement

enum LoginItemAction: Equatable {
  case register
  case unregister
  case openSettings
}

enum LoginItemIndicator: Equatable {
  case off
  case on
  case requiresApproval
}

enum LoginItemPolicy {
  static func action(for status: SMAppService.Status) -> LoginItemAction {
    switch status {
    case .enabled:
      return .unregister
    case .requiresApproval:
      return .openSettings
    case .notRegistered, .notFound:
      return .register
    @unknown default:
      return .register
    }
  }

  static func indicator(
    for status: SMAppService.Status
  ) -> LoginItemIndicator {
    switch status {
    case .enabled:
      return .on
    case .requiresApproval:
      return .requiresApproval
    case .notRegistered, .notFound:
      return .off
    @unknown default:
      return .off
    }
  }
}

enum LoginItemCommand: Equatable {
  case register
  case unregister
  case status
  case quitRunning

  static func resolve(arguments: [String]) -> LoginItemCommand? {
    guard arguments.count == 1 else {
      return nil
    }

    switch arguments[0] {
    case "--register-login-item":
      return .register
    case "--unregister-login-item":
      return .unregister
    case "--login-item-status":
      return .status
    case "--quit-running":
      return .quitRunning
    default:
      return nil
    }
  }
}

@MainActor
final class LoginItemManager {
  private let service: SMAppService

  init(service: SMAppService = .mainApp) {
    self.service = service
  }

  var isAvailable: Bool {
    Bundle.main.bundleURL.pathExtension.lowercased() == "app"
  }

  var status: SMAppService.Status {
    service.status
  }

  var statusDescription: String {
    switch status {
    case .notRegistered:
      return "not-registered"
    case .enabled:
      return "enabled"
    case .requiresApproval:
      return "requires-approval"
    case .notFound:
      return "not-found"
    @unknown default:
      return "unknown"
    }
  }

  func performMenuAction() throws {
    switch LoginItemPolicy.action(for: status) {
    case .register:
      try register()
    case .unregister:
      try unregister()
    case .openSettings:
      SMAppService.openSystemSettingsLoginItems()
    }
  }

  func register() throws {
    guard status != .enabled else {
      return
    }

    if status == .requiresApproval {
      SMAppService.openSystemSettingsLoginItems()
      return
    }

    try service.register()
    if status == .requiresApproval {
      SMAppService.openSystemSettingsLoginItems()
    }
  }

  func unregister() throws {
    guard status != .notRegistered else {
      return
    }

    try service.unregister()
  }
}
