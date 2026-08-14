import AppKit
import WebKit

private final class WindowChromeMessageRelay: NSObject, WKScriptMessageHandler {
  weak var controller: MenuBarWebViewController?

  init(controller: MenuBarWebViewController) {
    self.controller = controller
  }

  func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage
  ) {
    MainActor.assumeIsolated {
      self.controller?.handleWindowChromeMessage(message)
    }
  }
}

private final class NativeUpdateMessageRelay: NSObject, WKScriptMessageHandler {
  weak var controller: MenuBarWebViewController?

  init(controller: MenuBarWebViewController) {
    self.controller = controller
  }

  func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage
  ) {
    Task { @MainActor in
      self.controller?.handleNativeUpdateMessage(message)
    }
  }
}

private final class MenuBarReturnMessageRelay: NSObject, WKScriptMessageHandler {
  weak var controller: MenuBarWebViewController?

  init(controller: MenuBarWebViewController) {
    self.controller = controller
  }

  func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage
  ) {
    Task { @MainActor in
      self.controller?.handleMenuBarReturnMessage(message)
    }
  }
}

@MainActor
final class InitialLoadResultRelay {
  private var result: Result<Void, Error>?
  var observer: ((Result<Void, Error>) -> Void)? {
    didSet {
      if let result {
        observer?(result)
      }
    }
  }

  func finish(with result: Result<Void, Error>) {
    guard self.result == nil else {
      return
    }

    self.result = result
    observer?(result)
  }
}

@MainActor
final class MenuBarWebViewController: NSViewController, WKNavigationDelegate, WKUIDelegate {
  private let homeURL: URL
  private let readySelector: String?
  private let initialSize: NSSize
  private let usesWindowChrome: Bool
  private let canShowMenuBar: Bool
  private(set) weak var updateChecker: (any AppUpdateChecking)?
  private var webView: NativeChromeWebView!
  private var didCompleteInitialLoad = false
  private var isValidatingInitialLoad = false
  private var initialLoadValidationDeadline: Date?
  private let initialLoadResultRelay = InitialLoadResultRelay()

  var onLoadResult: ((Result<Void, Error>) -> Void)? {
    get {
      initialLoadResultRelay.observer
    }
    set {
      initialLoadResultRelay.observer = newValue
    }
  }

  var onOpenFloatingNote: ((URL) -> Void)?
  var onCloseWindow: (() -> Void)?
  var onShowMenuBar: (() -> Void)?

  init(
    homeURL: URL,
    preferredSize: NSSize = MenuBarConfiguration.popoverSize,
    readySelector: String? = ".menubar-shell",
    usesWindowChrome: Bool = false,
    canShowMenuBar: Bool = false,
    updateChecker: (any AppUpdateChecking)? = nil
  ) {
    self.homeURL = homeURL
    self.readySelector = readySelector
    initialSize = preferredSize
    self.usesWindowChrome = usesWindowChrome
    self.canShowMenuBar = canShowMenuBar
    self.updateChecker = updateChecker
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
      source: Self.nativeHostScriptSource(
        usesWindowChrome: usesWindowChrome,
        canShowMenuBar: canShowMenuBar,
        hasNativeUpdater: updateChecker != nil
      ),
      injectionTime: .atDocumentStart,
      forMainFrameOnly: true
    )
    configuration.userContentController.addUserScript(nativeHostScript)
    if usesWindowChrome {
      configuration.userContentController.add(
        WindowChromeMessageRelay(controller: self),
        name: NativeWindowPolicy.chromeMessageName
      )
    }
    if updateChecker != nil {
      configuration.userContentController.add(
        NativeUpdateMessageRelay(controller: self),
        name: NativeUpdatePolicy.messageName
      )
    }
    if canShowMenuBar {
      configuration.userContentController.add(
        MenuBarReturnMessageRelay(controller: self),
        name: NativeMenuBarReturnPolicy.messageName
      )
    }

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

  func refreshForPresentation(windowWasVisible: Bool) {
    guard isViewLoaded,
      MenuBarConfiguration.shouldRefreshWebContentForPresentation(
        currentURL: webView.url,
        isLoading: webView.isLoading,
        windowWasVisible: windowWasVisible
      )
    else {
      return
    }

    webView.load(MenuBarConfiguration.makeHomeRequest(for: homeURL))
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
    let lightsInset = NativeWindowPolicy.trafficLightsLeadingInset(in: webView, window: window)
    webView.titlebarPassthroughHeight = inset
    webView.titlebarPassthroughLeadingInset = lightsInset
    let insetCSS = NativeWindowPolicy.titlebarInsetCSSValue(inset)
    let lightsCSS = NativeWindowPolicy.titlebarInsetCSSValue(lightsInset)
    webView.evaluateJavaScript(
      """
      document.documentElement.style.setProperty('--native-titlebar-inset', '\(insetCSS)');
      document.documentElement.style.setProperty('--native-traffic-lights-inset', '\(lightsCSS)');
      """
    )
  }

  func handleWindowChromeMessage(_ message: WKScriptMessage) {
    guard usesWindowChrome,
      message.name == NativeWindowPolicy.chromeMessageName,
      let window = webView.window
    else {
      return
    }

    switch NativeWindowPolicy.chromeCommand(from: message.body) {
    case .drag:
      guard let event = NSApp.currentEvent, event.type == .leftMouseDown else {
        return
      }
      window.performDrag(with: event)
    case .zoom:
      window.performZoom(nil)
    case nil:
      break
    }
  }

  func handleNativeUpdateMessage(_ message: WKScriptMessage) {
    guard
      NativeUpdatePolicy.accepts(
        messageName: message.name,
        body: message.body,
        isMainFrame: message.frameInfo.isMainFrame,
        sourceURL: message.frameInfo.request.url,
        homeURL: homeURL
      )
    else {
      return
    }

    updateChecker?.checkForUpdates(nil)
  }

  func handleMenuBarReturnMessage(_ message: WKScriptMessage) {
    guard canShowMenuBar,
      NativeMenuBarReturnPolicy.accepts(
        messageName: message.name,
        body: message.body,
        isMainFrame: message.frameInfo.isMainFrame,
        sourceURL: message.frameInfo.request.url,
        homeURL: homeURL
      )
    else {
      return
    }

    onShowMenuBar?()
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
    initialLoadResultRelay.finish(with: result)
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

  static func nativeHostScriptSource(
    usesWindowChrome: Bool,
    canShowMenuBar: Bool = false,
    hasNativeUpdater: Bool = false
  ) -> String {
    let chromeFlag = usesWindowChrome ? "true" : "false"
    let menuBarFlag = canShowMenuBar ? "true" : "false"
    let updaterFlag = hasNativeUpdater ? "true" : "false"
    return """
    window.__doneLogNativeHost = true;
    window.__doneLogNativeChrome = \(chromeFlag);
    window.__doneLogCanShowMenuBar = \(menuBarFlag);
    window.__doneLogMenuBarMessage = '\(NativeMenuBarReturnPolicy.messageName)';
    window.__doneLogNativeUpdater = \(updaterFlag);
    window.__doneLogNativeUpdaterMessage = '\(NativeUpdatePolicy.messageName)';
     if (\(chromeFlag)) {
       document.documentElement.classList.add('is-native-host');
       document.documentElement.style.setProperty('--native-titlebar-inset', '28px');
       document.documentElement.style.setProperty('--native-traffic-lights-inset', '78px');
       if (!window.__doneLogNativeDragInstalled) {
         window.__doneLogNativeDragInstalled = true;
         const dragSelector = '.brand-row, .board-header, .panel-heading, .summary-top, .detail-header, .floating-note-header';
         const noDragSelector = 'button, a, input, textarea, select, label, option, [role="button"], [role="tab"], [contenteditable="true"], .header-actions, .board-header-actions, .theme-toggle, .calendar-picker, .view-toggle, .summary-date-navigation, .detail-window-actions, .floating-note-actions';
         document.addEventListener('mousedown', (event) => {
           const target = event.target;
           if (
             event.button !== 0 ||
             typeof target?.closest !== 'function' ||
             target.closest(noDragSelector) ||
             !target.closest(dragSelector)
           ) {
             return;
           }

           event.preventDefault();
           window.webkit?.messageHandlers?.doneLogWindow?.postMessage({
             command: 'drag',
           });
         });
       }
     }
    """
  }
}

enum MenuBarLoadError: LocalizedError {
  case expectedShellMissing

  var errorDescription: String? {
    "loaded page is not the Daymark menu bar route"
  }
}
