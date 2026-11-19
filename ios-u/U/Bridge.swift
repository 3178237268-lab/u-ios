import Foundation
import UIKit
import WebKit

/// 前端所有 UHost.* 调用都会落到这里。返回字符串（JSON），与安卓桥一一对应。
final class Bridge {

    weak var webView: WKWebView?
    weak var host: UIViewController?

    private let media = Media()
    private let camera = CameraSnap()
    private let downloads = Downloads()
    private let cache = CacheScan()
    private let device = Device()

    init() {
        LocalServer.shared.onBridge = { [weak self] name, args in
            guard let self = self else { return "" }
            return self.handle(name, args)
        }
        camera.onSnapDone = { [weak self] taskId, dataUrl, why in
            guard let self = self else { return }
            DispatchQueue.main.async {
                if let d = dataUrl {
                    self.js("window.__uSnap && window.__uSnap(\"\(taskId)\",\"\(d)\")")
                } else {
                    self.js("window.__uSnapFail && window.__uSnapFail(\"\(taskId)\",\"\(why ?? "error")\")")
                }
            }
        }
        downloads.onSaved = { [weak self] name, ok, msg in
            self?.js("window.__uDownloadDone && window.__uDownloadDone(\"\(name)\",\(ok))")
            _ = msg
        }
    }

    private func js(_ code: String) {
        webView?.evaluateJavaScript(code, completionHandler: nil)
    }

    private func handle(_ name: String, _ a: [String: String]) -> String {
        switch name {
        case "openUrl":
            if let s = a["url"], let u = URL(string: s) {
                DispatchQueue.main.async { UIApplication.shared.open(u) }
            }
            return "true"

        case "setTheme", "setImmersive":
            return "true"

        case "setLandscape", "setPortrait":
            return "true"

        case "refreshInfo":
            return device.refreshInfo()

        case "localIp":
            return device.localIp()

        case "discoveredServer":
            return device.discoveredServer()

        case "rescanServer":
            return device.rescanServer()

        case "deviceInfo":
            return device.info()

        case "hasGalleryPermission":
            return media.hasPermission() ? "true" : "false"

        case "listGallery":
            return media.list(limit: Int(a["limit"] ?? "") ?? 200)

        case "readGalleryItem":
            return media.readItem(gid: a["gid"] ?? "", maxPx: Int(a["maxPx"] ?? "") ?? 1280)

        case "listGalleryThumbs":
            return media.thumbs(limit: Int(a["limit"] ?? "") ?? 120)

        case "listGalleryThumbsPage":
            return media.thumbsPage(offset: Int(a["offset"] ?? "") ?? 0, limit: Int(a["limit"] ?? "") ?? 40)

        case "requestSnap":
            camera.request(taskId: a["taskId"] ?? "")
            return "true"

        case "downloadMedia":
            return downloads.start(url: a["url"] ?? "", name: a["name"] ?? "")

        case "downloadState":
            return downloads.state(id: a["id"] ?? "")

        case "openDownloaded":
            return downloads.open(name: a["name"] ?? "") ? "true" : "false"

        case "openDownloadFolder":
            return downloads.openFolder(name: a["name"] ?? "")

        case "deleteDownloaded":
            return downloads.delete(name: a["name"] ?? "")

        case "listApks":
            return ApkStore.list()

        case "saveApkBase64":
            return ApkStore.save(b64: a["b64"] ?? "", name: a["name"] ?? "") ? "true" : "false"

        case "installApk":
            // iOS 不能安装 APK：直接打开「文件」里的位置，让用户自己处理
            return ApkStore.reveal(name: a["name"] ?? "")

        case "deleteApkEx":
            return ApkStore.delete(name: a["name"] ?? "")

        case "deleteApk":
            return (ApkStore.deleteJson(name: a["name"] ?? "")["ok"] as? Bool ?? false) ? "true" : "false"

        case "cacheScan":
            return cache.scan()

        case "cacheDelete":
            return cache.delete(json: a["_body"] ?? a["paths"] ?? "")

        case "clearWebCache":
            DispatchQueue.main.async {
                WKWebsiteDataStore.default().removeData(
                    ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(),
                    modifiedSince: Date(timeIntervalSince1970: 0)
                ) { }
            }
            return "true"

        default:
            return ""
        }
    }
}

/// iOS 没有 APK，但「已下载的安装包」列表在网页里仍然存在：这里把文件放在
/// Documents/Downloads，配合 Info.plist 的 UIFileSharingEnabled，用户能在「文件」里看到。
enum ApkStore {
    static var dir: URL {
        let d = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Downloads", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }

    static func list() -> String {
        let fm = FileManager.default
        let items = (try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: [.fileSizeKey, .contentModificationDateKey])) ?? []
        let arr: [[String: Any]] = items.filter { $0.pathExtension.lowercased() == "apk" }.map { u in
            let v = try? u.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey])
            return [
                "name": u.lastPathComponent,
                "size": v?.fileSize ?? 0,
                "at": Int((v?.contentModificationDate ?? Date()).timeIntervalSince1970 * 1000)
            ]
        }
        return jsonString(arr)
    }

    static func save(b64: String, name: String) -> Bool {
        guard !name.isEmpty, let data = Data(base64Encoded: b64, options: .ignoreUnknownCharacters) else { return false }
        let safe = name.replacingOccurrences(of: "/", with: "_")
        do {
            try data.write(to: dir.appendingPathComponent(safe), options: .atomic)
            return true
        } catch { return false }
    }

    static func reveal(name: String) -> String {
        return "{}"
    }

    static func deleteJson(name: String) -> [String: Any] {
        let p = dir.appendingPathComponent(name.replacingOccurrences(of: "/", with: "_"))
        var ok = false
        if FileManager.default.fileExists(atPath: p.path) {
            ok = (try? FileManager.default.removeItem(at: p)) != nil
        }
        return ["ok": ok, "priv": ok, "media": false, "note": ""]
    }

    static func delete(name: String) -> String {
        return jsonString(deleteJson(name: name))
    }
}

func jsonString(_ obj: Any) -> String {
    guard JSONSerialization.isValidJSONObject(obj),
          let d = try? JSONSerialization.data(withJSONObject: obj, options: []),
          let s = String(data: d, encoding: .utf8) else { return "{}" }
    return s
}
