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
    dependencies: [
        .package(
            url: "https://github.com/sparkle-project/Sparkle",
            exact: "2.9.5"
        ),
    ],
    targets: [
        .executableTarget(
            name: "DoneLogMenuBar",
            dependencies: [
                .product(name: "Sparkle", package: "Sparkle"),
            ]
        ),
        .testTarget(
            name: "DoneLogMenuBarTests",
            dependencies: ["DoneLogMenuBar"]
        ),
    ]
)
