import AppKit
import Foundation

@MainActor
final class DoneLogApplicationDelegate: NSObject, NSApplicationDelegate {
  let windowCommands = NativeWindowCommandHandler()
  private var menuBarController: MenuBarController?
  private var smokeTimeout: DispatchWorkItem?
  private var didFinishSmokeCheck = false

  func applicationDidFinishLaunching(_ notification: Notification) {
    let controller = MenuBarController(
      url: MenuBarConfiguration.resolveURL()
    )
    menuBarController = controller

    let environment = ProcessInfo.processInfo.environment
    if NativeAppLaunchPolicy.shouldOpenFullApp(
      launchDate: NSRunningApplication.current.launchDate,
      environment: environment
    ) {
      controller.showFullApp()
    }

    if environment["MENUBAR_NATIVE_SMOKE"] == "1" {
      startSmokeCheck(controller: controller)
    }
  }

  func applicationShouldHandleReopen(
    _ sender: NSApplication,
    hasVisibleWindows flag: Bool
  ) -> Bool {
    menuBarController?.showFullApp()
    return false
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

    didFinishSmokeCheck = true
    smokeTimeout?.cancel()

    switch result {
    case .success where controller.isReady:
      FileHandle.standardOutput.write(
        Data("MENUBAR_NATIVE_READY\n".utf8)
      )
      NSApp.terminate(nil)
    case .success:
      FileHandle.standardError.write(
        Data("MENUBAR_NATIVE_FAILED status item is not ready\n".utf8)
      )
      exit(1)
    case .failure(let error):
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
    let isSmokeCheck = environment["MENUBAR_NATIVE_SMOKE"] == "1"
    let lockURL =
      isSmokeCheck
      ? SingleInstanceLock.smokeURL
      : SingleInstanceLock.defaultURL

    guard let instanceLock = SingleInstanceLock.acquire(at: lockURL) else {
      if isSmokeCheck {
        FileHandle.standardError.write(
          Data("MENUBAR_NATIVE_FAILED another smoke check is running\n".utf8)
        )
      } else {
        if let notificationName = MenuBarLaunchPolicy.lockContentionNotification(
          isSmokeCheck: false
        ) {
          DistributedNotificationCenter.default().postNotificationName(
            notificationName,
            object: nil,
            userInfo: nil,
            deliverImmediately: true
          )
        }
        FileHandle.standardOutput.write(
          Data("Done Log is already running\n".utf8)
        )
      }

      let exitCode = MenuBarLaunchPolicy.lockContentionExitCode(
        isSmokeCheck: isSmokeCheck
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
      windowCommands: delegate.windowCommands
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
        .doneLogQuit,
        object: nil,
        userInfo: nil,
        deliverImmediately: true
      )
      return 0
    }

    let manager = LoginItemManager()
    guard manager.isAvailable else {
      FileHandle.standardError.write(
        Data("LOGIN_ITEM_FAILED run this command from Done Log.app\n".utf8)
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
