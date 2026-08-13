import AppKit
import WebKit

@MainActor
final class MenuBarWebViewController: NSViewController, WKNavigationDelegate, WKUIDelegate {
  private let homeURL: URL
  private let readySelector: String?
  private let initialSize: NSSize
  private let usesWindowChrome: Bool
  private var webView: NativeChromeWebView!
  private var didCompleteInitialLoad = false
  private var isValidatingInitialLoad = false
  private var initialLoadValidationDeadline: Date?

  var onLoadResult: ((Result<Void, Error>) -> Void)?

  var onOpenFloatingNote: ((URL) -> Void)?
  var onCloseWindow: (() -> Void)?

  init(
    homeURL: URL,
    preferredSize: NSSize = MenuBarConfiguration.popoverSize,
    readySelector: String? = ".menubar-shell",
    usesWindowChrome: Bool = false
  ) {
    self.homeURL = homeURL
    self.readySelector = readySelector
    initialSize = preferredSize
    self.usesWindowChrome = usesWindowChrome
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  override func loadView() {
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = .default()
    let nativeHostScript = WKUserScript(
      source: Self.nativeHostScriptSource(usesWindowChrome: usesWindowChrome),
      injectionTime: .atDocumentStart,
      forMainFrameOnly: true
    )
    configuration.userContentController.addUserScript(nativeHostScript)

    webView = NativeChromeWebView(
      frame: NSRect(origin: .zero, size: initialSize),
      configuration: configuration
    )
    webView.navigationDelegate = self
    webView.uiDelegate = self
    webView.allowsMagnification = false
    webView.underPageBackgroundColor =
      usesWindowChrome ? NativeWindowPolicy.canvasColor : .clear
    view = webView

    webView.load(MenuBarConfiguration.makeHomeRequest(for: homeURL))
  }

  override func viewDidAppear() {
    super.viewDidAppear()
    if let window = view.window {
      syncNativeChrome(from: window)
    }
  }

  func webView(
    _ webView: WKWebView,
    createWebViewWith configuration: WKWebViewConfiguration,
    for navigationAction: WKNavigationAction,
    windowFeatures: WKWindowFeatures
  ) -> WKWebView? {
    if let url = navigationAction.request.url {
      if MenuBarNavigationPolicy.isFloatingNoteURL(url, homeURL: homeURL) {
        onOpenFloatingNote?(url)
      } else if MenuBarNavigationPolicy.isWebURL(url) {
        NSWorkspace.shared.open(url)
      }
    }
    return nil
  }

  func webViewDidClose(_ webView: WKWebView) {
    onCloseWindow?()
  }

  func webView(
    _ webView: WKWebView,
    decidePolicyFor navigationAction: WKNavigationAction,
    decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void
  ) {
    guard let url = navigationAction.request.url else {
      decisionHandler(.cancel)
      return
    }

    switch MenuBarNavigationPolicy.decide(url: url, homeURL: homeURL) {
    case .allowInPopover:
      decisionHandler(.allow)
    case .openExternal:
      NSWorkspace.shared.open(url)
      decisionHandler(.cancel)
    case .cancel:
      decisionHandler(.cancel)
    }
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    if let window = webView.window {
      syncNativeChrome(from: window)
    }
    validateInitialLoad(in: webView)
  }

  func syncNativeChrome(from window: NSWindow) {
    guard usesWindowChrome else {
      return
    }

    let inset = NativeWindowPolicy.titlebarInset(in: webView, window: window)
    webView.titlebarPassthroughHeight = inset
    let cssValue = NativeWindowPolicy.titlebarInsetCSSValue(inset)
    webView.evaluateJavaScript(
      "document.documentElement.style.setProperty('--native-titlebar-inset', '\(cssValue)');"
    )
  }

  func webView(
    _ webView: WKWebView,
    didFail navigation: WKNavigation!,
    withError error: Error
  ) {
    completeInitialLoad(with: .failure(error))
  }

  func webView(
    _ webView: WKWebView,
    didFailProvisionalNavigation navigation: WKNavigation!,
    withError error: Error
  ) {
    completeInitialLoad(with: .failure(error))
  }

  func webView(
    _ webView: WKWebView,
    requestMediaCapturePermissionFor origin: WKSecurityOrigin,
    initiatedByFrame frame: WKFrameInfo,
    type: WKMediaCaptureType,
    decisionHandler: @escaping @MainActor @Sendable (WKPermissionDecision) -> Void
  ) {
    decisionHandler(MenuBarPermissionPolicy.mediaCaptureDecision)
  }

  private func completeInitialLoad(with result: Result<Void, Error>) {
    guard !didCompleteInitialLoad else {
      return
    }

    didCompleteInitialLoad = true
    onLoadResult?(result)
  }

  private func validateInitialLoad(in webView: WKWebView) {
    guard !didCompleteInitialLoad, !isValidatingInitialLoad else {
      return
    }

    guard let readySelector else {
      completeInitialLoad(with: .success(()))
      return
    }

    isValidatingInitialLoad = true
    if initialLoadValidationDeadline == nil {
      initialLoadValidationDeadline = Date().addingTimeInterval(10)
    }

    webView.evaluateJavaScript(
      "document.querySelector('\(readySelector)') !== null"
    ) { [weak self] value, error in
      guard let self else {
        return
      }

      isValidatingInitialLoad = false
      if let error {
        completeInitialLoad(with: .failure(error))
        return
      }

      if let finalURL = webView.url,
        MenuBarLoadPolicy.isReady(
          finalURL: finalURL,
          homeURL: homeURL,
          hasMenuBarShell: value as? Bool == true
        )
      {
        completeInitialLoad(with: .success(()))
        return
      }

      if let deadline = initialLoadValidationDeadline,
        Date() < deadline
      {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
          self.validateInitialLoad(in: webView)
        }
        return
      }

      completeInitialLoad(
        with: .failure(MenuBarLoadError.expectedShellMissing)
      )
    }
  }

  static func nativeHostScriptSource(usesWindowChrome: Bool) -> String {
    let chromeFlag = usesWindowChrome ? "true" : "false"
    return """
    window.__doneLogNativeHost = true;
    window.__doneLogNativeChrome = \(chromeFlag);
    if (\(chromeFlag)) {
      document.documentElement.classList.add('is-native-host');
      document.documentElement.style.setProperty('--native-titlebar-inset', '28px');
    }
    """
  }
}

enum MenuBarLoadError: LocalizedError {
  case expectedShellMissing

  var errorDescription: String? {
    "loaded page is not the Done Log menu bar route"
  }
}
