import AppKit
import Foundation

guard CommandLine.arguments.count == 2 else {
  FileHandle.standardError.write(
    Data("usage: generate-app-icon.swift <iconset-directory>\n".utf8)
  )
  exit(64)
}

let outputDirectory = URL(
  fileURLWithPath: CommandLine.arguments[1],
  isDirectory: true
)
try FileManager.default.createDirectory(
  at: outputDirectory,
  withIntermediateDirectories: true
)

let iconSizes = [16, 32, 128, 256, 512]
for pointSize in iconSizes {
  try writeIcon(
    pixels: pointSize,
    to: outputDirectory.appendingPathComponent(
      "icon_\(pointSize)x\(pointSize).png"
    )
  )
  try writeIcon(
    pixels: pointSize * 2,
    to: outputDirectory.appendingPathComponent(
      "icon_\(pointSize)x\(pointSize)@2x.png"
    )
  )
}

func writeIcon(pixels: Int, to outputURL: URL) throws {
  guard
    let bitmap = NSBitmapImageRep(
      bitmapDataPlanes: nil,
      pixelsWide: pixels,
      pixelsHigh: pixels,
      bitsPerSample: 8,
      samplesPerPixel: 4,
      hasAlpha: true,
      isPlanar: false,
      colorSpaceName: .deviceRGB,
      bytesPerRow: 0,
      bitsPerPixel: 0
    ),
    let context = NSGraphicsContext(bitmapImageRep: bitmap)
  else {
    throw IconGenerationError.couldNotCreateBitmap
  }

  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = context
  context.imageInterpolation = .high

  let size = CGFloat(pixels)
  let canvas = NSRect(x: 0, y: 0, width: size, height: size)
  NSColor.clear.setFill()
  canvas.fill()

  let inset = size * 0.04
  let backgroundRect = canvas.insetBy(dx: inset, dy: inset)
  let background = NSBezierPath(
    roundedRect: backgroundRect,
    xRadius: size * 0.22,
    yRadius: size * 0.22
  )
  NSColor(
    srgbRed: 0.03,
    green: 0.47,
    blue: 0.46,
    alpha: 1
  ).setFill()
  background.fill()

  let circleInset = size * 0.22
  let circle = NSBezierPath(
    ovalIn: canvas.insetBy(dx: circleInset, dy: circleInset)
  )
  circle.lineWidth = size * 0.065
  NSColor.white.withAlphaComponent(0.96).setStroke()
  circle.stroke()

  let check = NSBezierPath()
  check.move(to: NSPoint(x: size * 0.33, y: size * 0.50))
  check.line(to: NSPoint(x: size * 0.45, y: size * 0.38))
  check.line(to: NSPoint(x: size * 0.69, y: size * 0.64))
  check.lineWidth = size * 0.075
  check.lineCapStyle = .round
  check.lineJoinStyle = .round
  NSColor.white.setStroke()
  check.stroke()

  NSGraphicsContext.restoreGraphicsState()

  guard let data = bitmap.representation(using: .png, properties: [:]) else {
    throw IconGenerationError.couldNotEncodePNG
  }
  try data.write(to: outputURL, options: .atomic)
}

enum IconGenerationError: Error {
  case couldNotCreateBitmap
  case couldNotEncodePNG
}
