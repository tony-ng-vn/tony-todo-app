import Foundation
import WebKit

enum MenuBarNavigationDecision: Equatable {
  case allowInPopover
  case openExternal
  case cancel
}

enum MenuBarNavigationPolicy {
  static func decide(url: URL, homeURL: URL) -> MenuBarNavigationDecision {
    guard isWebURL(url) else {
      return .cancel
    }

    return hasSameOrigin(url, homeURL) ? .allowInPopover : .openExternal
  }

  static func isWebURL(_ url: URL) -> Bool {
    guard let scheme = url.scheme?.lowercased() else {
      return false
    }

    return (scheme == "http" || scheme == "https") && url.host != nil
  }

  private static func hasSameOrigin(_ first: URL, _ second: URL) -> Bool {
    first.scheme?.lowercased() == second.scheme?.lowercased()
      && first.host?.lowercased() == second.host?.lowercased()
      && effectivePort(for: first) == effectivePort(for: second)
  }

  private static func effectivePort(for url: URL) -> Int? {
    if let port = url.port {
      return port
    }

    switch url.scheme?.lowercased() {
    case "http":
      return 80
    case "https":
      return 443
    default:
      return nil
    }
  }
}

enum MenuBarPermissionPolicy {
  static let mediaCaptureDecision = WKPermissionDecision.deny
}

enum MenuBarLoadPolicy {
  static func isReady(
    finalURL: URL,
    homeURL: URL,
    hasMenuBarShell: Bool
  ) -> Bool {
    hasMenuBarShell
      && MenuBarNavigationPolicy.decide(url: finalURL, homeURL: homeURL)
        == .allowInPopover
  }
}
