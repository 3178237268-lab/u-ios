import Foundation
import Photos
import UIKit

/// 相册索引与小图：字段和安卓完全一致（id / name / mime / size / takenAt）。
final class Media {

    private var cachedIds: [String] = []

    func hasPermission() -> Bool {
        let st = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        return st == .authorized || st == .limited
    }

    func requestPermission(_ done: @escaping (Bool) -> Void) {
        PHPhotoLibrary.requestAuthorization(for: .readWrite) { st in
            done(st == .authorized || st == .limited)
        }
    }

    private func assets(limit: Int) -> [PHAsset] {
        let opts = PHFetchOptions()
        opts.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
        opts.fetchLimit = max(1, min(limit, 500))
        let images = PHAsset.fetchAssets(with: .image, options: opts)
        let videos = PHAsset.fetchAssets(with: .video, options: opts)
        var out: [PHAsset] = []
        images.enumerateObjects { a, _, _ in if out.count < opts.fetchLimit { out.append(a) } }
        videos.enumerateObjects { a, _, _ in if out.count < opts.fetchLimit { out.append(a) } }
        out.sort { ($0.creationDate ?? Date.distantPast) > ($1.creationDate ?? Date.distantPast) }
        return out
    }

    private func item(_ a: PHAsset) -> [String: Any] {
        let res = PHAssetResource.assetResources(for: a).first
        let name = res?.originalFilename ?? (a.mediaType == .video ? "video.mp4" : "photo.jpg")
        let mime = a.mediaType == .video ? "video/mp4" : "image/jpeg"
        return [
            "id": a.localIdentifier,
            "name": name,
            "mime": mime,
            "size": Media.fileSize(a),
            "takenAt": Int((a.creationDate ?? Date()).timeIntervalSince1970 * 1000)
        ]
    }

    /// PHAsset 没有公开的 fileSize，只能从 PHAssetResource 的私有属性里取：
    /// 先 responds(to:) 再读，避免 KVC 撞到未定义 key 直接抛异常崩掉。
    static func fileSize(_ a: PHAsset) -> Int {
        guard let res = PHAssetResource.assetResources(for: a).first,
              res.responds(to: NSSelectorFromString("fileSize")),
              let n = res.value(forKey: "fileSize") as? NSNumber else { return 0 }
        return n.intValue
    }

    func list(limit: Int) -> String {
        guard hasPermission() else { return "[]" }
        return jsonString(assets(limit: limit).map { item($0) })
    }

    private func asset(by id: String) -> PHAsset? {
        PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject
    }

    /// 压到 maxPx 之内的 JPEG base64
    func readItem(gid: String, maxPx: Int) -> String {
        guard hasPermission(), !gid.isEmpty, let a = asset(by: gid) else { return "" }
        let px = CGFloat(max(240, min(2048, maxPx)))
        let sem = DispatchSemaphore(value: 0)
        var out = ""
        let opts = PHImageRequestOptions()
        opts.isSynchronous = false
        opts.deliveryMode = .highQualityFormat
        opts.resizeMode = .exact
        opts.isNetworkAccessAllowed = true
        PHImageManager.default().requestImage(for: a, targetSize: CGSize(width: px, height: px),
                                              contentMode: .aspectFit, options: opts) { img, _ in
            if let img = img, let data = img.jpegData(compressionQuality: 0.78) {
                out = "data:image/jpeg;base64," + data.base64EncodedString()
            }
            sem.signal()
        }
        _ = sem.wait(timeout: .now() + 12)
        return out
    }

    func thumbs(limit: Int) -> String {
        guard hasPermission() else { return "{}" }
        var map: [String: String] = [:]
        for a in assets(limit: max(1, min(60, limit))) {
            let d = thumb(a, px: 640)
            if !d.isEmpty { map[a.localIdentifier] = d }
        }
        return jsonString(map)
    }

    func thumbsPage(offset: Int, limit: Int) -> String {
        guard hasPermission() else { return "{\"count\":0,\"thumbs\":{}}" }
        let all = assets(limit: 500)
        let start = max(0, offset)
        let end = min(all.count, start + max(1, min(60, limit)))
        var map: [String: String] = [:]
        if start < end {
            for a in all[start..<end] {
                let d = thumb(a, px: 360)
                if !d.isEmpty { map[a.localIdentifier] = d }
            }
        }
        return jsonString(["count": max(0, end - start), "thumbs": map] as [String: Any])
    }

    private func thumb(_ a: PHAsset, px: CGFloat) -> String {
        let sem = DispatchSemaphore(value: 0)
        var out = ""
        let opts = PHImageRequestOptions()
        opts.deliveryMode = .fastFormat
        opts.resizeMode = .fast
        opts.isNetworkAccessAllowed = true
        PHImageManager.default().requestImage(for: a, targetSize: CGSize(width: px, height: px),
                                              contentMode: .aspectFill, options: opts) { img, _ in
            if let img = img, let data = img.jpegData(compressionQuality: 0.68) {
                out = "data:image/jpeg;base64," + data.base64EncodedString()
            }
            sem.signal()
        }
        _ = sem.wait(timeout: .now() + 10)
        return out
    }
}
