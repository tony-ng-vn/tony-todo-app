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
    #expect(style != .borderless)
    #expect(!style.contains(.fullSizeContentView))
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
}
