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

  static let reopenIntentRestoreNanoseconds: UInt64 = 350_000_000

  @MainActor
  private static var currentReopenIntent = Reopen.user
  @MainActor
  private static var reopenIntentGeneration = 0
  @MainActor
  private static var scheduledReopenIntentRestore: (
    generation: Int,
    previousIntent: Reopen
  )?

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
    allowUnhosted: Bool = false,
    hasOpenedFullApp: Bool = false
  ) -> Bool {
    !hasOpenedFullApp
      && action == .openFullApp
      && (statusItemIsReady || allowUnhosted)
  }

  static func shouldOpenFullAppAfterTimeout(
    action: Action,
    statusItemIsReady: Bool,
    elapsed: TimeInterval,
    hasOpenedFullApp: Bool = false
  ) -> Bool {
    !hasOpenedFullApp
      && action == .openFullApp
      && !statusItemIsReady
      && elapsed >= statusItemHostTimeout
  }

  static func shouldKeepWaitingForStatusItem(
    statusItemIsReady: Bool,
    elapsed: TimeInterval
  ) -> Bool {
    !statusItemIsReady && elapsed < statusItemRetryTimeout
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
    reopenIntentGeneration += 1
    let generation = reopenIntentGeneration
    scheduledReopenIntentRestore = (generation, previousIntent)
    let result = try action()
    let restoreDelay =
      Double(reopenIntentRestoreNanoseconds) / 1_000_000_000
    DispatchQueue.main.asyncAfter(deadline: .now() + restoreDelay) {
      Task { @MainActor in
        restoreReopenIntent(
          generation: generation,
          previousIntent: previousIntent
        )
      }
    }
    return result
  }

  @MainActor
  static func flushScheduledReopenIntentRestore() {
    guard let scheduled = scheduledReopenIntentRestore else {
      return
    }
    restoreReopenIntent(
      generation: scheduled.generation,
      previousIntent: scheduled.previousIntent
    )
  }

  @MainActor
  private static func restoreReopenIntent(
    generation: Int,
    previousIntent: Reopen
  ) {
    guard generation == reopenIntentGeneration else {
      return
    }
    scheduledReopenIntentRestore = nil
    currentReopenIntent = previousIntent
  }
}
