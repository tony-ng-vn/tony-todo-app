import Foundation
import Testing

@testable import DoneLogMenuBar

@Suite("Native update policy")
struct NativeUpdatePolicyTests {
  @Test("Accepts only an explicit user update check")
  func parsesUpdateCommands() {
    #expect(
      NativeUpdatePolicy.command(from: ["command": "check"])
        == .check
    )
    #expect(NativeUpdatePolicy.command(from: ["command": "install"]) == nil)
    #expect(NativeUpdatePolicy.command(from: "check") == nil)
  }

  @Test("Uses a stable bootstrap download for legacy native apps")
  func exposesBootstrapDownload() {
    #expect(
      NativeUpdatePolicy.bootstrapDownloadURL.absoluteString
        == "https://github.com/tony-ng-vn/tony-todo-app/releases/latest/download/Done-Log.dmg"
    )
  }
}
