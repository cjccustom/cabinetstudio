// swift-tools-version: 5.9

// CJC Room Scan: scans a room with the LiDAR scanner (Apple's RoomPlan) and saves the walls,
// doors and windows for Cabinet Studio. Open this folder in Xcode and run it on an iPhone Pro
// or iPad Pro.

import PackageDescription
import AppleProductTypes

let package = Package(
    name: "CJC Room Scan",
    platforms: [
        .iOS("17.0")
    ],
    products: [
        .iOSApplication(
            name: "CJC Room Scan",
            targets: ["AppModule"],
            bundleIdentifier: "com.cjccustomcarpentry.roomscan",
            displayVersion: "1.0",
            bundleVersion: "1",
            appIcon: .placeholder(icon: .leaf),
            accentColor: .presetColor(.blue),
            supportedDeviceFamilies: [
                .pad,
                .phone
            ],
            supportedInterfaceOrientations: [
                .portrait,
                .landscapeRight,
                .landscapeLeft,
                .portraitUpsideDown(.when(deviceFamilies: [.pad]))
            ],
            capabilities: [
                .camera(purposeString: "The camera and LiDAR scanner measure the room.")
            ]
        )
    ],
    targets: [
        .executableTarget(
            name: "AppModule",
            path: "."
        )
    ]
)
