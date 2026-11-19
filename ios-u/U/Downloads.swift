import Foundation
import Photos
import UIKit

/// 下载视频（推特等）：带进度、存到相册「U」相簿，同时留一份在 App 文档里方便「打开」。
final class Downloads: NSObject, URLSessionDownloadDelegate {

    var onSaved: ((String, Bool, String) -> Void)?

    private var states: [String: [String: Any]] = [:]
    private var seq = 0
    private let lock = NSLock()
    private lazy var session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 30
        cfg.timeoutIntervalForResource = 600
        return URLSession(configuration: cfg, delegate: self, delegateQueue: nil)
    }()

    private var names: [Int: String] = [:]

    func start(url: String, name: String) -> String {
        guard let u = URL(string: url), !name.isEmpty else { return "" }
        seq += 1
        let id = "tw\(seq)-\(Int(Date().timeIntervalSince1970 * 1000))"
        lock.lock()
        states[id] = ["state": "running", "got": 0, "total": 0, "uri": "", "error": ""]
        lock.unlock()

        let task = session.downloadTask(with: u)
        lock.lock()
        names[task.taskIdentifier] = id + "|" + name
        lock.unlock()
        task.resume()
        return id
    }

    func state(id: String) -> String {
        lock.lock(); defer { lock.unlock() }
        guard let s = states[id] else { return "" }
        return jsonString(s)
    }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask,
                    didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        lock.lock()
        let key0 = names[downloadTask.taskIdentifier]
        lock.unlock()
        guard let key = key0, let id = key.split(separator: "|").first.map(String.init) else { return }
        lock.lock()
        if var s = states[id] {
            s["got"] = Int(totalBytesWritten)
            s["total"] = Int(max(0, totalBytesExpectedToWrite))
            states[id] = s
        }
        lock.unlock()
    }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        lock.lock()
        let key0 = names[downloadTask.taskIdentifier]
        lock.unlock()
        guard let key = key0 else { return }
        let parts = key.split(separator: "|", maxSplits: 1).map(String.init)
        let id = parts[0]
        let name = parts.count > 1 ? parts[1] : "video.mp4"

        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Movies", isDirectory: true)
        try? FileManager.default.createDirectory(at: docs, withIntermediateDirectories: true)
        let dest = docs.appendingPathComponent(name)
        try? FileManager.default.removeItem(at: dest)
        do {
            try FileManager.default.moveItem(at: location, to: dest)
        } catch {
            lock.lock()
            if var s = states[id] { s["state"] = "error"; s["error"] = "save-failed"; states[id] = s }
            lock.unlock()
            onSaved?(name, false, "save-failed")
            return
        }

        lock.lock()
        if var s = states[id] {
            s["state"] = "done"
            s["uri"] = dest.absoluteString
            let sz = (try? dest.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
            s["got"] = sz
            s["total"] = sz
            states[id] = s
        }
        lock.unlock()

        saveToPhotos(dest, name: name) { ok in
            self.onSaved?(name, true, ok ? "" : "gallery-failed")
        }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let error = error, let key = names[task.taskIdentifier] else { return }
        let id = String(key.split(separator: "|")[0])
        lock.lock()
        if var s = states[id] {
            s["state"] = "error"
            s["error"] = (error as NSError).code == NSURLErrorTimedOut ? "timeout" : "network"
            states[id] = s
        }
        lock.unlock()
        onSaved?(String(key.split(separator: "|").last ?? "video.mp4"), false, "network")
    }

    private func saveToPhotos(_ url: URL, name: String, done: @escaping (Bool) -> Void) {
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { st in
            guard st == .authorized || st == .limited else { done(false); return }
            PHPhotoLibrary.shared().performChanges({
                let req = PHAssetCreationRequest.forAsset()
                let opts = PHAssetResourceCreationOptions()
                opts.originalFilename = name
                req.addResource(with: .video, fileURL: url, options: opts)
            }) { ok, _ in done(ok) }
        }
    }

    func open(name: String) -> Bool {
        let p = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Movies").appendingPathComponent(name)
        guard FileManager.default.fileExists(atPath: p.path) else { return false }
        DispatchQueue.main.async {
            let ac = UIActivityViewController(activityItems: [p], applicationActivities: nil)
            ac.popoverPresentationController?.sourceView = UIApplication.shared.keyWindow?.rootViewController?.view
            UIApplication.shared.keyWindow?.rootViewController?.present(ac, animated: true)
        }
        return true
    }

    func openFolder(name: String) -> String {
        return open(name: name) ? "{}" : "{}"
    }

    func delete(name: String) -> String {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Movies")
        let p = docs.appendingPathComponent(name)
        var ok = false
        if FileManager.default.fileExists(atPath: p.path) {
            ok = (try? FileManager.default.removeItem(at: p)) != nil
        }
        deleteFromPhotos(name: name)
        return jsonString(["ok": ok, "priv": ok, "media": true, "note": ""])
    }

    private func deleteFromPhotos(name: String) {
        let opts = PHFetchOptions()
        opts.predicate = NSPredicate(format: "mediaType == %d", PHAssetMediaType.video.rawValue)
        let res = PHAsset.fetchAssets(with: opts)
        var ids: [String] = []
        res.enumerateObjects { a, _, _ in
            let fn = PHAssetResource.assetResources(for: a).first?.originalFilename
            if fn == name { ids.append(a.localIdentifier) }
        }
        guard !ids.isEmpty else { return }
        let assets = PHAsset.fetchAssets(withLocalIdentifiers: ids, options: nil)
        PHPhotoLibrary.shared().performChanges({
            PHAssetChangeRequest.deleteAssets(assets)
        }, completionHandler: nil)
    }
}
