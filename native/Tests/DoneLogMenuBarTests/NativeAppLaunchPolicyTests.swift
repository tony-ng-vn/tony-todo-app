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

  @Test("Waits until the status extra is hosted before opening the full window")
  func waitsForHostedStatusItem() {
    #expect(
      NativeAppLaunchPolicy.shouldKeepWaitingForStatusItem(
        statusItemIsReady: false,
        elapsed: 0.2
      )
    )
    #expect(
      !NativeAppLaunchPolicy.shouldOpenFullAppNow(
        action: .openFullApp,
        statusItemIsReady: false
      )
    )
  }

  @Test("Opens the full window once the status extra is in the menu bar")
  func opensFullAppAfterStatusItemIsReady() {
    #expect(
      NativeAppLaunchPolicy.shouldOpenFullAppNow(
        action: .openFullApp,
        statusItemIsReady: true
      )
    )
    #expect(
      !NativeAppLaunchPolicy.shouldKeepWaitingForStatusItem(
        statusItemIsReady: true,
        elapsed: 0.2
      )
    )
  }

  @Test("Opens the full window after the extra fails to host")
  func opensFullAppAfterStatusItemTimeout() {
    #expect(
      NativeAppLaunchPolicy.shouldOpenFullAppAfterTimeout(
        action: .openFullApp,
        statusItemIsReady: false,
        elapsed: 1
      )
    )
    #expect(
      !NativeAppLaunchPolicy.shouldOpenFullAppAfterTimeout(
        action: .keepCurrentWindows,
        statusItemIsReady: false,
        elapsed: 1
      )
    )
  }

  @Test("Opens the full window immediately on a user reopen")
  func opensFullAppImmediatelyOnReopen() {
    #expect(
      NativeAppLaunchPolicy.shouldOpenFullAppNow(
        action: .openFullApp,
        statusItemIsReady: false,
        allowUnhosted: true
      )
    )
  }

  @Test("Recreates an unhosted status extra once during launch")
  func recreatesUnhostedStatusItemOnce() {
    #expect(
      NativeAppLaunchPolicy.shouldRecreateStatusItem(
        statusItemIsReady: false,
        alreadyRecreated: false,
        elapsed: 0.5
      )
    )
    #expect(
      !NativeAppLaunchPolicy.shouldRecreateStatusItem(
        statusItemIsReady: false,
        alreadyRecreated: true,
        elapsed: 0.5
      )
    )
    #expect(
      !NativeAppLaunchPolicy.shouldRecreateStatusItem(
        statusItemIsReady: true,
        alreadyRecreated: false,
        elapsed: 0.5
      )
    )
  }
}
