import Foundation

/// 扫出这台 iPhone 上所有 U 相关文件（App 文档、Caches、tmp），并能真删。
final class CacheScan {

    private let fm = FileManager.default

    private var roots: [(URL, String)] {
        var out: [(URL, String)] = []
        let docs = fm.urls(for: .documentDirectory, in: .userDomainMask)[0]
        out.append((docs, "app"))
        out.append((docs.appendingPathComponent("Movies"), "movie"))
        out.append((docs.appendingPathComponent("Downloads"), "download"))
        if let c = fm.urls(for: .cachesDirectory, in: .userDomainMask).first { out.append((c, "app")) }
        out.append((URL(fileURLWithPath: NSTemporaryDirectory()), "app"))
        return out
    }

    func scan() -> String {
        var items: [[String: Any]] = []
        var seen = Set<String>()
        var total = 0

        for (root, where_) in roots {
            walk(root, where_, 0, &items, &seen, &total)
        }
        return jsonString(["bytes": total, "count": items.count, "items": items] as [String: Any])
    }

    private func walk(_ dir: URL, _ where_: String, _ depth: Int,
                      _ items: inout [[String: Any]], _ seen: inout Set<String>, _ total: inout Int) {
        guard depth <= 6 else { return }
        let keys: [URLResourceKey] = [.isDirectoryKey, .fileSizeKey, .nameKey]
        guard let list = try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: keys) else { return }
        for u in list {
            let v = try? u.resourceValues(forKeys: Set(keys))
            if v?.isDirectory == true {
                walk(u, where_, depth + 1, &items, &seen, &total)
                continue
            }
            let size = v?.fileSize ?? 0
            if size <= 0 { continue }
            let path = u.path
            if seen.contains(path) { continue }
            seen.insert(path)
            total += size
            items.append([
                "p": "n:" + path,
                "n": u.lastPathComponent,
                "s": size,
                "t": kind(u.lastPathComponent),
                "w": where_
            ])
        }
    }

    private func kind(_ name: String) -> String {
        let n = name.lowercased()
        let video = ["mp4", "m4v", "webm", "mov", "mkv"]
        let image = ["jpg", "jpeg", "png", "webp", "gif", "heic"]
        if video.contains(where: { n.hasSuffix("." + $0) }) { return "video" }
        if image.contains(where: { n.hasSuffix("." + $0) }) { return "image" }
        return "other"
    }

    func delete(json: String) -> String {
        guard let data = json.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data),
              let arr = obj as? [String] else {
            return "{\"ok\":0,\"fail\":0}"
        }
        var ok = 0, fail = 0
        for raw in arr {
            let p = raw.hasPrefix("n:") ? String(raw.dropFirst(2)) : raw
            if fm.fileExists(atPath: p) {
                if (try? fm.removeItem(atPath: p)) != nil { ok += 1 } else { fail += 1 }
            } else {
                ok += 1
            }
        }
        return jsonString(["ok": ok, "fail": fail])
    }
}
