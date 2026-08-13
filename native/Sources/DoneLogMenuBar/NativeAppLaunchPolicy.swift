import Foundation

enum NativeAppLaunchPolicy {
  enum InitialLaunch: Equatable {
    case launchServices
    case loginItem
    case smokeCheck
  }

  enum Reopen: Equatable {
    case user
    case floatingNoteActivation
  }

  enum Intent: Equatable {
    case initial(InitialLaunch)
    case reopen(Reopen)
  }

  enum Action: Equatable {
    case openFullApp
    case keepCurrentWindows
  }

  @MainActor
  private static var currentReopenIntent = Reopen.user

  static func initialIntent(
    launchDate: Date?,
    environment: [String: String] = ProcessInfo.processInfo.environment
  ) -> Intent {
    if environment["MENUBAR_NATIVE_SMOKE"] == "1" {
      return .initial(.smokeCheck)
    }

    return launchDate == nil
      ? .initial(.loginItem)
      : .initial(.launchServices)
  }

  static func action(for intent: Intent) -> Action {
    switch intent {
    case .initial(.launchServices), .reopen(.user):
      return .openFullApp
    case .initial(.loginItem), .initial(.smokeCheck),
      .reopen(.floatingNoteActivation):
      return .keepCurrentWindows
    }
  }

  @MainActor
  static var reopenAction: Action {
    action(for: .reopen(currentReopenIntent))
  }

  @MainActor
  static func withReopenIntent<Result>(
    _ intent: Reopen,
    perform action: () throws -> Result
  ) rethrows -> Result {
    let previousIntent = currentReopenIntent
    currentReopenIntent = intent
    defer {
      currentReopenIntent = previousIntent
    }
    return try action()
  }
}
