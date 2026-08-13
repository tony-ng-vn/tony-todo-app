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
    #expect(window.isOpaque == false)
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
}
