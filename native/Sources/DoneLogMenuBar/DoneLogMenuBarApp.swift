import AppKit
import Foundation

@MainActor
final class DoneLogApplicationDelegate: NSObject, NSApplicationDelegate {
  let windowCommands = NativeWindowCommandHandler()
  let updateCoordinator = AppUpdateCoordinator()
  private var menuBarController: MenuBarController?
  private var smokeTimeout: DispatchWorkItem?
  private var didFinishSmokeCheck = false

  func applicationDidFinishLaunching(_ notification: Notification) {
    let controller = MenuBarController(
      url: MenuBarConfiguration.resolveURL(),
      updateChecker: updateCoordinator
    )
    menuBarController = controller

    let environment = ProcessInfo.processInfo.environment
    let launchIntent = NativeAppLaunchPolicy.initialIntent(
      launchDate: NSRunningApplication.current.launchDate,
      environment: environment
    )
    hostStatusItem(
      controller: controller,
      startedAt: Date(),
      action: NativeAppLaunchPolicy.action(for: launchIntent)
    )

    if environment["MENUBAR_NATIVE_SMOKE"] == "1" {
      startSmokeCheck(controller: controller)
    }
  }

  func applicationShouldHandleReopen(
    _ sender: NSApplication,
    hasVisibleWindows flag: Bool
  ) -> Bool {
    guard let controller = menuBarController else {
      return false
    }

    hostStatusItem(
      controller: controller,
      startedAt: Date(),
      action: NativeAppLaunchPolicy.reopenAction,
      allowUnhosted: true
    )
    return false
  }

  private func hostStatusItem(
    controller: MenuBarController,
    startedAt: Date,
    action: NativeAppLaunchPolicy.Action,
    allowUnhosted: Bool = false,
    hasOpenedFullApp: Bool = false
  ) {
    let elapsed = Date().timeIntervalSince(startedAt)
    let shouldOpenFullApp = NativeAppLaunchPolicy.shouldOpenFullAppNow(
      action: action,
      statusItemIsReady: controller.isReady,
      allowUnhosted: allowUnhosted,
      hasOpenedFullApp: hasOpenedFullApp
    ) || NativeAppLaunchPolicy.shouldOpenFullAppAfterTimeout(
      action: action,
      statusItemIsReady: controller.isReady,
      elapsed: elapsed,
      hasOpenedFullApp: hasOpenedFullApp
    )
    if shouldOpenFullApp {
      controller.showFullApp()
    }

    if controller.isReady {
      return
    }

    if NativeAppLaunchPolicy.shouldKeepWaitingForStatusItem(
      statusItemIsReady: controller.isReady,
      elapsed: elapsed
    ) {
      controller.revealStatusItem()
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
        [weak self, weak controller] in
        guard let controller else {
          return
        }
        self?.hostStatusItem(
          controller: controller,
          startedAt: startedAt,
          action: action,
          allowUnhosted: allowUnhosted,
          hasOpenedFullApp: hasOpenedFullApp || shouldOpenFullApp
        )
      }
    }
  }

  private func startSmokeCheck(controller: MenuBarController) {
    controller.onLoadResult = { [weak self, weak controller] result in
      guard let controller else {
        return
      }
      self?.finishSmokeCheck(result: result, controller: controller)
    }

    let timeout = DispatchWorkItem { [weak self, weak controller] in
      guard let controller else {
        return
      }
      self?.finishSmokeCheck(
        result: .failure(MenuBarSmokeError.loadTimedOut),
        controller: controller
      )
    }
    smokeTimeout = timeout
    DispatchQueue.main.asyncAfter(deadline: .now() + 15, execute: timeout)
  }

  private func finishSmokeCheck(
    result: Result<Void, Error>,
    controller: MenuBarController
  ) {
    guard !didFinishSmokeCheck else {
      return
    }

    switch result {
    case .success where controller.isReady:
      didFinishSmokeCheck = true
      smokeTimeout?.cancel()
      FileHandle.standardOutput.write(
        Data("MENUBAR_NATIVE_READY\n".utf8)
      )
      NSApp.terminate(nil)
    case .success:
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
        [weak self, weak controller] in
        guard let controller else {
          return
        }
        self?.finishSmokeCheck(result: .success(()), controller: controller)
      }
    case .failure(let error):
      didFinishSmokeCheck = true
      smokeTimeout?.cancel()
      FileHandle.standardError.write(
        Data("MENUBAR_NATIVE_FAILED \(error.localizedDescription)\n".utf8)
      )
      exit(1)
    }
  }
}

enum MenuBarSmokeError: LocalizedError {
  case loadTimedOut

  var errorDescription: String? {
    "menu bar route load timed out"
  }
}

@main
enum DoneLogMenuBarApp {
  @MainActor
  static func main() {
    if let exitCode = runLoginItemCommandIfNeeded() {
      exit(exitCode)
    }

    let environment = ProcessInfo.processInfo.environment
    let lockURL = MenuBarLaunchPolicy.lockURL(environment: environment)

    guard let instanceLock = SingleInstanceLock.acquire(at: lockURL) else {
      if MenuBarLaunchPolicy.instanceKind(environment: environment) == .smoke {
        FileHandle.standardError.write(
          Data("MENUBAR_NATIVE_FAILED another smoke check is running\n".utf8)
        )
      } else {
        if let notificationName = MenuBarLaunchPolicy.lockContentionNotification(
          environment: environment
        ) {
          DistributedNotificationCenter.default().postNotificationName(
            notificationName,
            object: nil,
            userInfo: nil,
            deliverImmediately: true
          )
        }
        FileHandle.standardOutput.write(
          Data("Daymark is already running\n".utf8)
        )
      }

      let exitCode = MenuBarLaunchPolicy.lockContentionExitCode(
        environment: environment
      )
      if exitCode != 0 {
        exit(exitCode)
      }
      return
    }

    let application = NSApplication.shared
    let delegate = DoneLogApplicationDelegate()
    application.delegate = delegate
    let mainMenu = ApplicationMenuFactory.makeMainMenu(
      windowCommands: delegate.windowCommands,
      updateChecker: delegate.updateCoordinator
    )
    application.mainMenu = mainMenu
    application.windowsMenu = mainMenu.items.first {
      $0.title == "Window"
    }?.submenu
    application.setActivationPolicy(.accessory)
    withExtendedLifetime(instanceLock) {
      application.run()
    }
  }

  @MainActor
  private static func runLoginItemCommandIfNeeded() -> Int32? {
    let arguments = Array(CommandLine.arguments.dropFirst())
    guard let command = LoginItemCommand.resolve(arguments: arguments) else {
      return nil
    }

    if command == .quitRunning {
      DistributedNotificationCenter.default().postNotificationName(
        MenuBarLaunchPolicy.quitNotification(),
        object: nil,
        userInfo: nil,
        deliverImmediately: true
      )
      return 0
    }

    let manager = LoginItemManager()
    guard manager.isAvailable else {
      FileHandle.standardError.write(
        Data("LOGIN_ITEM_FAILED run this command from Daymark.app\n".utf8)
      )
      return 1
    }

    do {
      switch command {
      case .register:
        try manager.register()
      case .unregister:
        try manager.unregister()
      case .status:
        break
      case .quitRunning:
        break
      }

      FileHandle.standardOutput.write(
        Data("LOGIN_ITEM_STATUS \(manager.statusDescription)\n".utf8)
      )
      return 0
    } catch {
      FileHandle.standardError.write(
        Data("LOGIN_ITEM_FAILED \(error.localizedDescription)\n".utf8)
      )
      return 1
    }
  }
}
