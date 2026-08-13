import Foundation
import Testing

@testable import DoneLogMenuBar

@Suite("Native app launch policy")
struct NativeAppLaunchPolicyTests {
  @Test("Opens the full window for a normal LaunchServices launch")
  func opensFullWindowForNormalLaunch() {
    let intent = NativeAppLaunchPolicy.initialIntent(
      launchDate: Date(),
      environment: [:]
    )

    #expect(intent == .initial(.launchServices))
    #expect(NativeAppLaunchPolicy.action(for: intent) == .openFullApp)
  }

  @Test("Stays menu-bar-only when macOS starts the login item")
  func staysInBackgroundAtLogin() {
    let intent = NativeAppLaunchPolicy.initialIntent(
      launchDate: nil,
      environment: [:]
    )

    #expect(intent == .initial(.loginItem))
    #expect(NativeAppLaunchPolicy.action(for: intent) == .keepCurrentWindows)
  }

  @Test("Keeps smoke checks in the background")
  func keepsSmokeChecksInBackground() {
    let intent = NativeAppLaunchPolicy.initialIntent(
      launchDate: Date(),
      environment: ["MENUBAR_NATIVE_SMOKE": "1"]
    )

    #expect(intent == .initial(.smokeCheck))
    #expect(NativeAppLaunchPolicy.action(for: intent) == .keepCurrentWindows)
  }

  @Test("Opens the full window for a user reopen")
  @MainActor
  func opensFullWindowForUserReopen() {
    #expect(NativeAppLaunchPolicy.reopenAction == .openFullApp)
  }

  @Test("Keeps the full window closed during floating-note activation")
  @MainActor
  func keepsFullWindowClosedForFloatingNoteActivation() {
    var activationAction: NativeAppLaunchPolicy.Action?

    NativeAppLaunchPolicy.withReopenIntent(.floatingNoteActivation) {
      activationAction = NativeAppLaunchPolicy.reopenAction
    }

    #expect(activationAction == .keepCurrentWindows)
    #expect(NativeAppLaunchPolicy.reopenAction == .openFullApp)
  }
}
