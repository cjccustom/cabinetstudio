import RoomPlan
import SwiftUI

struct ContentView: View {
    @State private var name = ""
    @State private var scanning = false
    @State private var scan: ScanFile?
    @State private var files: [URL] = []
    @State private var problem: String?

    var body: some View {
        NavigationStack {
            Form {
                if !RoomCaptureSession.isSupported {
                    Section {
                        Text("This device has no LiDAR scanner. Room scanning needs an iPhone Pro (12 Pro or later) or an iPad Pro.")
                    }
                } else {
                    Section("Room") {
                        TextField("Client and room, e.g. Pope library", text: $name)
                        Button {
                            scanning = true
                        } label: {
                            Label(scan == nil ? "Scan the room" : "Scan again", systemImage: "viewfinder")
                        }
                    }
                    Section {
                        Text("Walk slowly around the room, pointing at each wall, the floor and the ceiling. Doors and windows are picked up on the way. Tap Done when every wall is outlined.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                if let scan {
                    Section("Room size") {
                        LabeledContent("Ceiling", value: feetInches(scan.ceilingHeight))
                        ForEach(Array(scan.walls.enumerated()), id: \.element.id) { i, wall in
                            LabeledContent("Wall \(i + 1)", value: feetInches(wall.length))
                        }
                    }
                    if !scan.openings.isEmpty {
                        Section("Doors and windows") {
                            ForEach(scan.openings, id: \.id) { o in
                                LabeledContent(o.kind.capitalized, value: "\(feetInches(o.width)) × \(feetInches(o.height))")
                            }
                        }
                    }
                    Section {
                        ShareLink(items: files) {
                            Label("Send the scan", systemImage: "square.and.arrow.up")
                        }
                        Text("Save it to the client’s Dropbox folder, or AirDrop it to your Mac. In Cabinet Studio: Design → Room → Import room scan.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                if let problem {
                    Section {
                        Text(problem).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("CJC Room Scan")
        }
        .fullScreenCover(isPresented: $scanning) {
            ScanScreen(
                onFinish: { room in
                    save(room)
                    scanning = false
                },
                onCancel: { scanning = false }
            )
        }
    }

    private func save(_ room: CapturedRoom) {
        let file = ScanFile(room: room, name: name)
        let stamp = DateFormatter()
        stamp.dateFormat = "yyyy-MM-dd HHmm"
        let label = name.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "/", with: "-")
        let base = "Room scan - \(label.isEmpty ? "room" : label) - \(stamp.string(from: Date()))"
        let dir = FileManager.default.temporaryDirectory
        do {
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            let json = dir.appendingPathComponent("\(base).json")
            try encoder.encode(file).write(to: json)
            var out = [json]
            // The 3D model too, for looking at the room later
            let usdz = dir.appendingPathComponent("\(base).usdz")
            if (try? room.export(to: usdz)) != nil { out.append(usdz) }
            files = out
            scan = file
            problem = nil
        } catch {
            problem = "Couldn’t save the scan: \(error.localizedDescription)"
        }
    }
}

/// Apple's scanning screen, with Done and Cancel.
struct ScanScreen: View {
    let onFinish: (CapturedRoom) -> Void
    let onCancel: () -> Void
    @StateObject private var controller = ScanController()
    @State private var finishing = false

    var body: some View {
        ZStack(alignment: .bottom) {
            CaptureViewRepresentable(controller: controller)
                .ignoresSafeArea()
            HStack {
                Button("Cancel") {
                    controller.stop()
                    onCancel()
                }
                Spacer()
                if let room = controller.result {
                    Button("Use this scan") { onFinish(room) }
                        .buttonStyle(.borderedProminent)
                } else if let failure = controller.failure {
                    Text(failure).font(.footnote).foregroundStyle(.red)
                } else {
                    Button(finishing ? "Finishing…" : "Done") {
                        finishing = true
                        controller.stop()
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(finishing)
                }
            }
            .padding()
            .background(.ultraThinMaterial)
        }
        .onAppear { controller.start() }
    }
}
