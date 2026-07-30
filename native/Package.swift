// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "DoneLogMenuBar",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .executable(
            name: "done-log-menubar",
            targets: ["DoneLogMenuBar"]
        ),
    ],
    targets: [
        .executableTarget(
            name: "DoneLogMenuBar"
        ),
        .testTarget(
            name: "DoneLogMenuBarTests",
            dependencies: ["DoneLogMenuBar"]
        ),
    ]
)
