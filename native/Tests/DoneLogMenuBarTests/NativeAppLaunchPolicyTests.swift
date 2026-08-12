import Foundation
import Testing

@testable import DoneLogMenuBar

@Suite("Native app launch policy")
struct NativeAppLaunchPolicyTests {
  @Test("Opens the full window for a normal LaunchServices launch")
  func opensFullWindowForNormalLaunch() {
    #expect(
      NativeAppLaunchPolicy.shouldOpenFullApp(
        launchDate: Date(),
        environment: [:]
      )
    )
  }

  @Test("Stays menu-bar-only when macOS starts the login item")
  func staysInBackgroundAtLogin() {
    #expect(
      !NativeAppLaunchPolicy.shouldOpenFullApp(
        launchDate: nil,
        environment: [:]
      )
    )
  }

  @Test("Keeps smoke checks in the background")
  func keepsSmokeChecksInBackground() {
    #expect(
      !NativeAppLaunchPolicy.shouldOpenFullApp(
        launchDate: Date(),
        environment: ["MENUBAR_NATIVE_SMOKE": "1"]
      )
    )
  }
}
