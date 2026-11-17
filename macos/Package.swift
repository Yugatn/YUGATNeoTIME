// swift-tools-version: 5.9
import PackageDescription

var products: [Product] = [
    .library(name: "TimeCore", targets: ["TimeCore"])
]
var targets: [Target] = [
    .target(name: "TimeCore", path: "Sources/TimeCore"),
    .testTarget(name: "TimeCoreTests", dependencies: ["TimeCore"], path: "Tests/TimeCoreTests")
]
#if os(macOS)
products.append(.executable(name: "YUGATNeoTIME", targets: ["YUGATNeoTIME"]))
targets.append(.executableTarget(
    name: "YUGATNeoTIME", dependencies: ["TimeCore"], path: "Sources/YugatNeoTime"
))
#endif

let package = Package(
    name: "YUGATNeoTIME",
    defaultLocalization: "ru",
    platforms: [.macOS(.v14)],
    products: products,
    targets: targets
)
