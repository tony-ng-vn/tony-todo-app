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

  @Test("Accepts update checks only from the trusted main frame")
  func requiresTrustedMainFrame() throws {
    let homeURL = try #require(
      URL(string: "https://daymark.inhavens.com/menubar")
    )
    let trustedURL = try #require(
      URL(string: "https://daymark.inhavens.com/menubar?local=1")
    )
    let untrustedURL = try #require(
      URL(string: "https://example.com/embedded")
    )

    #expect(
      NativeUpdatePolicy.accepts(
        messageName: NativeUpdatePolicy.messageName,
        body: ["command": "check"],
        isMainFrame: true,
        sourceURL: trustedURL,
        homeURL: homeURL
      )
    )
    #expect(
      !NativeUpdatePolicy.accepts(
        messageName: NativeUpdatePolicy.messageName,
        body: ["command": "check"],
        isMainFrame: false,
        sourceURL: trustedURL,
        homeURL: homeURL
      )
    )
    #expect(
      !NativeUpdatePolicy.accepts(
        messageName: NativeUpdatePolicy.messageName,
        body: ["command": "check"],
        isMainFrame: true,
        sourceURL: untrustedURL,
        homeURL: homeURL
      )
    )
  }
}
