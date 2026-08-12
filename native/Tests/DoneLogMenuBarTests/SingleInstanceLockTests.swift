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
}
