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

  static let statusItemHostTimeout: TimeInterval = 1
  static let statusItemRetryTimeout: TimeInterval = 8
  static let statusItemRecreateLimit = 3

  static func action(for intent: Intent) -> Action {
    switch intent {
    case .initial(.launchServices), .reopen(.user):
      return .openFullApp
    case .initial(.loginItem), .initial(.smokeCheck),
      .reopen(.floatingNoteActivation):
      return .keepCurrentWindows
    }
  }

  static func shouldOpenFullAppNow(
    action: Action,
    statusItemIsReady: Bool,
    allowUnhosted: Bool = false
  ) -> Bool {
    action == .openFullApp && (statusItemIsReady || allowUnhosted)
  }

  static func shouldOpenFullAppAfterTimeout(
    action: Action,
    statusItemIsReady: Bool,
    elapsed: TimeInterval
  ) -> Bool {
    action == .openFullApp
      && !statusItemIsReady
      && elapsed >= statusItemHostTimeout
  }

  static func shouldKeepWaitingForStatusItem(
    statusItemIsReady: Bool,
    elapsed: TimeInterval
  ) -> Bool {
    !statusItemIsReady && elapsed < statusItemRetryTimeout
  }

  static func shouldRecreateStatusItem(
    statusItemIsReady: Bool,
    recreateCount: Int,
    elapsed: TimeInterval
  ) -> Bool {
    !statusItemIsReady
      && recreateCount < statusItemRecreateLimit
      && elapsed >= 0.4 * Double(recreateCount + 1)
      && elapsed < statusItemRetryTimeout
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
