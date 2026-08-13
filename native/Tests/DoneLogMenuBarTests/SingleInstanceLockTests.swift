import Foundation
import Testing

@testable import DoneLogMenuBar

@Suite("Single instance lock", .serialized)
struct SingleInstanceLockTests {
  @Test("Allows only one process lock at a time")
  func allowsOnlyOneLock() throws {
    let lockURL = FileManager.default.temporaryDirectory
      .appendingPathComponent("done-log-test-\(UUID().uuidString).lock")
    defer {
      try? FileManager.default.removeItem(at: lockURL)
    }

    var firstLock = SingleInstanceLock.acquire(at: lockURL)
    #expect(firstLock != nil)
    #expect(SingleInstanceLock.acquire(at: lockURL) == nil)

    withExtendedLifetime(firstLock) {}
    firstLock = nil
    #expect(SingleInstanceLock.acquire(at: lockURL) != nil)
  }

  @Test("Fails smoke checks when their lock is already held")
  func failsConcurrentSmokeCheck() {
    #expect(MenuBarLaunchPolicy.lockContentionExitCode(isSmokeCheck: true) == 1)
    #expect(MenuBarLaunchPolicy.lockContentionExitCode(isSmokeCheck: false) == 0)
  }

  @Test("Repeated app launches request the full native window")
  func repeatedLaunchRequestsFullNativeWindow() {
    #expect(
      MenuBarLaunchPolicy.lockContentionNotification(isSmokeCheck: false)
        == .doneLogShowFullApp
    )
    #expect(
      MenuBarLaunchPolicy.lockContentionNotification(isSmokeCheck: true)
        == nil
    )
  }

  @Test("Keeps local worktree instances off the production lock")
  func isolatesDevelopmentLockFromProduction() {
    let productionLock = MenuBarLaunchPolicy.lockURL(environment: [:])
    let developmentLock = MenuBarLaunchPolicy.lockURL(
      environment: [
        "DONE_LOG_INSTANCE": "dev",
        "DONE_LOG_INSTANCE_ID": "worktreeabc",
      ]
    )

    #expect(productionLock == SingleInstanceLock.defaultURL)
    #expect(developmentLock.lastPathComponent ==
      "com.tonynguyen.done-log-menubar.dev.worktreeabc.lock")
    #expect(productionLock != developmentLock)
  }

  @Test("Local worktree launches do not wake the installed app")
  func developmentContentionDoesNotNotifyProduction() {
    #expect(
      MenuBarLaunchPolicy.lockContentionNotification(environment: [:])
        == .doneLogShowFullApp
    )
    #expect(
      MenuBarLaunchPolicy.lockContentionNotification(
        environment: [
          "DONE_LOG_INSTANCE": "dev",
          "DONE_LOG_INSTANCE_ID": "worktreeabc",
        ]
      ) != .doneLogShowFullApp
    )
    #expect(
      MenuBarLaunchPolicy.quitNotification(
        environment: [
          "DONE_LOG_INSTANCE": "dev",
          "DONE_LOG_INSTANCE_ID": "worktreeabc",
        ]
      ) != .doneLogQuit
    )
  }
}
