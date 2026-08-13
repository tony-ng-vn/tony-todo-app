import AppKit
import Testing

@testable import DoneLogMenuBar

@Suite("Native window policy")
struct NativeWindowPolicyTests {
  @Test("Uses standard resizable macOS window controls")
  func usesStandardWindowControls() {
    let style = NativeWindowPolicy.primaryStyleMask

    #expect(style.contains(.titled))
    #expect(style.contains(.closable))
    #expect(style.contains(.miniaturizable))
    #expect(style.contains(.resizable))
    #expect(style.contains(.fullSizeContentView))
    #expect(NativeWindowPolicy.floatingNoteStyleMask == style)
    #expect(!NativeWindowPolicy.floatingNoteStyleMask.contains(.utilityWindow))
    #expect(style != .borderless)
    #expect(NativeWindowPolicy.fullScreenMenuTitle(isFullScreen: false) == "Enter Full Screen")
    #expect(NativeWindowPolicy.fullScreenMenuTitle(isFullScreen: true) == "Exit Full Screen")
  }

  @Test("Zoom fills the usable screen while preserving a fallback")
  func choosesStandardZoomFrame() {
    let fallback = NSRect(x: 120, y: 80, width: 1280, height: 820)
    let visibleScreen = NSRect(x: 0, y: 40, width: 1800, height: 1120)

    #expect(
      NativeWindowPolicy.standardFrame(
        defaultFrame: fallback,
        screenVisibleFrame: visibleScreen
      ) == visibleScreen
    )
    #expect(
      NativeWindowPolicy.standardFrame(
        defaultFrame: fallback,
        screenVisibleFrame: nil
      ) == fallback
    )
  }

  @Test("Does not cap the full app at its initial size")
  @MainActor
  func leavesRoomForWindowZoom() throws {
    let controller = FullAppWindowController(
      url: try #require(URL(string: "https://example.com/"))
    )
    let window = try #require(controller.window)

    #expect(window.contentMaxSize.width > 1_800)
    #expect(window.contentMaxSize.height > 1_130)
    #expect(window.contentViewController?.preferredContentSize == .zero)
  }

  @Test("Uses the same unified chrome for floating notes")
  @MainActor
  func floatingNotesUseTransparentUnifiedChrome() throws {
    let controller = FloatingNoteWindowController(
      url: try #require(URL(string: "https://example.com/menubar?note=task-1"))
    ) {}
    let window = try #require(controller.window)

    #expect(window.styleMask.contains(.titled))
    #expect(window.styleMask.contains(.fullSizeContentView))
    #expect(!window.styleMask.contains(.utilityWindow))
    #expect(window.titlebarAppearsTransparent)
    #expect(window.titleVisibility == .hidden)
    #expect(window.titlebarSeparatorStyle == .none)
    #expect(window.appearance?.name == .darkAqua)
    #expect(window.backgroundColor == NativeWindowPolicy.canvasColor)
    #expect(window.isOpaque)
    #expect(window.standardWindowButton(.closeButton)?.isHidden != true)
    #expect(window.contentView is NativeChromeWebView)
  }

  @Test("Hides the system title bar so content can fill the window")
  @MainActor
  func usesTransparentUnifiedChrome() throws {
    let controller = FullAppWindowController(
      url: try #require(URL(string: "https://example.com/"))
    )
    let window = try #require(controller.window)

    #expect(window.styleMask.contains(.fullSizeContentView))
    #expect(window.titlebarAppearsTransparent)
    #expect(window.titleVisibility == .hidden)
    #expect(window.titlebarSeparatorStyle == .none)
    #expect(window.appearance?.name == .darkAqua)
    #expect(window.backgroundColor == NativeWindowPolicy.canvasColor)
    #expect(window.isOpaque)
    #expect(window.standardWindowButton(.closeButton)?.isHidden != true)
    #expect(window.standardWindowButton(.miniaturizeButton)?.isHidden != true)
    #expect(window.standardWindowButton(.zoomButton)?.isHidden != true)
    #expect(window.contentView is NativeChromeWebView)
    #expect(!(window.contentView is NSVisualEffectView))
  }

  @Test("Uses the screen visible frame for the native zoom action")
  @MainActor
  func zoomsToTheUsableScreen() throws {
    let controller = FullAppWindowController(
      url: try #require(URL(string: "https://example.com/"))
    )
    let window = try #require(controller.window)
    let visibleFrame = try #require(window.screen?.visibleFrame)
    window.setFrame(
      NSRect(x: 200, y: 160, width: 1_000, height: 700),
      display: false
    )

    window.performZoom(nil)

    #expect(window.frame == visibleFrame)
  }

  @Test("Passes only the traffic-light titlebar hits through")
  @MainActor
  func passesTitlebarHitsThrough() {
    let webView = NativeChromeWebView(
      frame: NSRect(x: 0, y: 0, width: 1_200, height: 800)
    )
    webView.titlebarPassthroughHeight = 28
    webView.titlebarPassthroughLeadingInset = 78

    #expect(webView.isFlipped)
    #expect(webView.hitTest(NSPoint(x: 24, y: 10)) == nil)
    #expect(webView.hitTest(NSPoint(x: 240, y: 10)) != nil)
    #expect(webView.hitTest(NSPoint(x: 24, y: 790)) != nil)
  }

  @Test("Measures the real title bar inset after chrome is applied")
  @MainActor
  func measuresTitlebarInset() throws {
    let controller = FullAppWindowController(
      url: try #require(URL(string: "https://example.com/"))
    )
    let window = try #require(controller.window)
    let contentView = try #require(window.contentView)
    window.setFrame(
      NSRect(x: 80, y: 80, width: 1_200, height: 800),
      display: false
    )

    let layout = contentView.convert(window.contentLayoutRect, from: nil)
    let expectedInset = layout.minY - contentView.bounds.minY
    let inset = NativeWindowPolicy.titlebarInset(in: contentView, window: window)

    #expect(contentView.isFlipped)
    #expect(expectedInset > 0)
    #expect(inset == expectedInset)
  }

  @Test("Removes the title bar inset in full screen")
  func measuresZeroInsetInFullScreen() {
    let bounds = NSRect(x: 0, y: 0, width: 1_200, height: 800)
    let layout = NSRect(x: 0, y: 32, width: 1_200, height: 768)

    let inset = NativeWindowPolicy.titlebarInset(
      layoutRect: layout,
      bounds: bounds,
      isFlipped: true,
      isFullScreen: true
    )

    #expect(inset == 0)
    #expect(NativeWindowPolicy.titlebarInsetCSSValue(inset) == "0px")
    #expect(
      !NativeWindowPolicy.isTitlebarPassthroughPoint(
        NSPoint(x: 24, y: 10),
        in: bounds,
        titlebarInset: inset,
        trafficLightsLeadingInset: 78,
        isFlipped: true
      )
    )
  }

  @Test("Keeps the leading traffic-light slot for window drag and zoom")
  func reservesTrafficLightDragSlot() {
    let bounds = NSRect(x: 0, y: 0, width: 1_200, height: 800)

    #expect(
      NativeWindowPolicy.isTitlebarPassthroughPoint(
        NSPoint(x: 24, y: 10),
        in: bounds,
        titlebarInset: 28,
        trafficLightsLeadingInset: 78,
        isFlipped: true
      )
    )
    #expect(
      !NativeWindowPolicy.isTitlebarPassthroughPoint(
        NSPoint(x: 240, y: 10),
        in: bounds,
        titlebarInset: 28,
        trafficLightsLeadingInset: 78,
        isFlipped: true
      )
    )
    #expect(NativeWindowPolicy.trafficLightsLeadingInset(zoomMaxX: 62) == 78)
    #expect(NativeWindowPolicy.chromeCommand(from: ["command": "zoom"]) == .zoom)
    #expect(NativeWindowPolicy.chromeCommand(from: ["command": "nope"]) == nil)
  }
}
