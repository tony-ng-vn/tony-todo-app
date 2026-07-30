import Darwin
import Foundation

final class SingleInstanceLock {
  static let defaultURL = FileManager.default.temporaryDirectory
    .appendingPathComponent("com.tonynguyen.done-log-menubar.lock")
  static let smokeURL = FileManager.default.temporaryDirectory
    .appendingPathComponent("com.tonynguyen.done-log-menubar.smoke.lock")

  private let fileDescriptor: Int32

  private init(fileDescriptor: Int32) {
    self.fileDescriptor = fileDescriptor
  }

  static func acquire(at url: URL = defaultURL) -> SingleInstanceLock? {
    let fileDescriptor = open(
      url.path,
      O_CREAT | O_RDWR,
      S_IRUSR | S_IWUSR
    )
    guard fileDescriptor >= 0 else {
      return nil
    }

    guard flock(fileDescriptor, LOCK_EX | LOCK_NB) == 0 else {
      close(fileDescriptor)
      return nil
    }

    return SingleInstanceLock(fileDescriptor: fileDescriptor)
  }

  deinit {
    flock(fileDescriptor, LOCK_UN)
    close(fileDescriptor)
  }
}

extension Notification.Name {
  static let doneLogShowPopover = Notification.Name(
    "com.tonynguyen.done-log-menubar.show-popover"
  )
  static let doneLogQuit = Notification.Name(
    "com.tonynguyen.done-log-menubar.quit"
  )
}

enum MenuBarLaunchPolicy {
  static func lockContentionExitCode(isSmokeCheck: Bool) -> Int32 {
    isSmokeCheck ? 1 : 0
  }
}
