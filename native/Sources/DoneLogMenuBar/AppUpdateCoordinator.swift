import AppKit
import Sparkle

@MainActor
final class AppUpdateCoordinator: NSObject, AppUpdateChecking {
  private let updaterController: SPUStandardUpdaterController

  override init() {
    updaterController = SPUStandardUpdaterController(
      startingUpdater: true,
      updaterDelegate: nil,
      userDriverDelegate: nil
    )
    super.init()
  }

  @objc func checkForUpdates(_ sender: Any?) {
    updaterController.checkForUpdates(sender)
  }
}
