import ServiceManagement
import Testing

@testable import DoneLogMenuBar

@Suite("Login item policy")
struct LoginItemPolicyTests {
  @Test(
    "Chooses the correct action for each system status",
    arguments: [
      (SMAppService.Status.notRegistered, LoginItemAction.register),
      (SMAppService.Status.enabled, LoginItemAction.unregister),
      (SMAppService.Status.requiresApproval, LoginItemAction.openSettings),
      (SMAppService.Status.notFound, LoginItemAction.register),
    ]
  )
  func choosesAction(
    status: SMAppService.Status,
    expectedAction: LoginItemAction
  ) {
    #expect(LoginItemPolicy.action(for: status) == expectedAction)
  }

  @Test(
    "Builds the correct indicator for each system status",
    arguments: [
      (SMAppService.Status.notRegistered, LoginItemIndicator.off),
      (SMAppService.Status.enabled, LoginItemIndicator.on),
      (
        SMAppService.Status.requiresApproval,
        LoginItemIndicator.requiresApproval
      ),
      (SMAppService.Status.notFound, LoginItemIndicator.off),
    ]
  )
  func buildsIndicator(
    status: SMAppService.Status,
    expectedIndicator: LoginItemIndicator
  ) {
    #expect(LoginItemPolicy.indicator(for: status) == expectedIndicator)
  }

  @Test(
    "Recognizes login item commands",
    arguments: [
      (["--register-login-item"], LoginItemCommand.register),
      (["--unregister-login-item"], LoginItemCommand.unregister),
      (["--login-item-status"], LoginItemCommand.status),
      (["--quit-running"], LoginItemCommand.quitRunning),
    ]
  )
  func recognizesCommand(
    arguments: [String],
    expectedCommand: LoginItemCommand
  ) {
    #expect(LoginItemCommand.resolve(arguments: arguments) == expectedCommand)
  }

  @Test("Ignores normal app arguments")
  func ignoresNormalArguments() {
    #expect(LoginItemCommand.resolve(arguments: []) == nil)
    #expect(LoginItemCommand.resolve(arguments: ["--unexpected"]) == nil)
  }
}
