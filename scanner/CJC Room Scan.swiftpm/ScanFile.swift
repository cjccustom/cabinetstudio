import Foundation
import RoomPlan
import simd

/// The scan, simplified for Cabinet Studio: walls and openings in inches, with the floor at 0.
/// Plan coordinates are x and z from the scan (looking down on the room); y is up.
struct ScanFile: Codable {
    var app = "CJC Room Scan"
    var version = 1
    var name: String
    var scannedAt: String
    var units = "inches"
    var ceilingHeight: Double
    var walls: [Wall]
    var openings: [Opening]

    struct Wall: Codable {
        var id: String
        var start: [Double]
        var end: [Double]
        var length: Double
        var height: Double
    }

    struct Opening: Codable {
        var id: String
        /// door, window or opening
        var kind: String
        /// The wall it's in, when RoomPlan knows.
        var wall: String?
        var center: [Double]
        var width: Double
        var height: Double
        var sill: Double
    }
}

private let inchesPerMeter = 39.3701

private func eighth(_ v: Double) -> Double { (v * 8).rounded() / 8 }

private func position(_ t: simd_float4x4) -> SIMD3<Double> {
    SIMD3(Double(t.columns.3.x), Double(t.columns.3.y), Double(t.columns.3.z))
}

extension ScanFile {
    init(room: CapturedRoom, name: String) {
        // The floor is the bottom of the lowest wall
        let floorY = room.walls.map { Double($0.transform.columns.3.y) - Double($0.dimensions.y) / 2 }.min() ?? 0

        let walls: [Wall] = room.walls.map { w in
            let c = position(w.transform)
            // A wall's width runs along its own x axis
            let along = SIMD3(Double(w.transform.columns.0.x), Double(w.transform.columns.0.y), Double(w.transform.columns.0.z))
            let half = Double(w.dimensions.x) / 2
            let a = c - along * half
            let b = c + along * half
            return Wall(
                id: w.identifier.uuidString,
                start: [eighth(a.x * inchesPerMeter), eighth(a.z * inchesPerMeter)],
                end: [eighth(b.x * inchesPerMeter), eighth(b.z * inchesPerMeter)],
                length: eighth(Double(w.dimensions.x) * inchesPerMeter),
                height: eighth(Double(w.dimensions.y) * inchesPerMeter)
            )
        }

        func opening(_ s: CapturedRoom.Surface, _ kind: String) -> Opening {
            let c = position(s.transform)
            let h = Double(s.dimensions.y)
            return Opening(
                id: s.identifier.uuidString,
                kind: kind,
                wall: s.parentIdentifier?.uuidString,
                center: [eighth(c.x * inchesPerMeter), eighth((c.y - floorY) * inchesPerMeter), eighth(c.z * inchesPerMeter)],
                width: eighth(Double(s.dimensions.x) * inchesPerMeter),
                height: eighth(h * inchesPerMeter),
                sill: eighth(max(0, c.y - h / 2 - floorY) * inchesPerMeter)
            )
        }

        self.init(
            name: name,
            scannedAt: ISO8601DateFormatter().string(from: Date()),
            ceilingHeight: walls.map(\.height).max() ?? 0,
            walls: walls,
            openings: room.doors.map { opening($0, "door") }
                + room.windows.map { opening($0, "window") }
                + room.openings.map { opening($0, "opening") }
        )
    }
}

/// 158.5 → 13' 2-1/2"
func feetInches(_ inches: Double) -> String {
    let total = (inches * 8).rounded() / 8
    let feet = Int(total / 12)
    let rest = total - Double(feet) * 12
    let whole = Int(rest)
    let eighths = Int(((rest - Double(whole)) * 8).rounded())
    var frac = ""
    if eighths > 0 {
        var n = eighths, d = 8
        while n % 2 == 0 { n /= 2; d /= 2 }
        frac = "-\(n)/\(d)"
    }
    return feet > 0 ? "\(feet)' \(whole)\(frac)\"" : "\(whole)\(frac)\""
}
