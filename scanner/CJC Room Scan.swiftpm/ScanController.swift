import RoomPlan
import SwiftUI
import UIKit

/// Runs Apple's room capture screen and hands back the finished room.
@MainActor
final class ScanController: NSObject, ObservableObject, RoomCaptureViewDelegate {
    let captureView = RoomCaptureView(frame: .zero)
    @Published var result: CapturedRoom?
    @Published var failure: String?

    override init() {
        super.init()
        captureView.delegate = self
    }

    // RoomCaptureViewDelegate inherits NSCoding; the scan screen is never archived.
    required init?(coder: NSCoder) { return nil }
    nonisolated func encode(with coder: NSCoder) {}

    func start() {
        result = nil
        failure = nil
        captureView.captureSession.run(configuration: RoomCaptureSession.Configuration())
    }

    func stop() {
        captureView.captureSession.stop()
    }

    nonisolated func captureView(shouldPresent roomDataForProcessing: CapturedRoomData, error: Error?) -> Bool {
        true
    }

    nonisolated func captureView(didPresent processedResult: CapturedRoom, error: Error?) {
        DispatchQueue.main.async {
            if let error {
                self.failure = error.localizedDescription
            } else {
                self.result = processedResult
            }
        }
    }
}

/// Puts the capture screen inside SwiftUI.
struct CaptureViewRepresentable: UIViewRepresentable {
    let controller: ScanController

    func makeUIView(context: Context) -> RoomCaptureView {
        controller.captureView
    }

    func updateUIView(_ uiView: RoomCaptureView, context: Context) {}
}
