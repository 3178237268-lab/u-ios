import Foundation
import Network

/// 极小的本地 HTTP 服务：把 bundle 里的 www 目录跑在 http://127.0.0.1:<port>/，
/// 同时把 /bridge/<method> 交给原生处理（前端用同步 XHR 调，保持和安卓一样的同步语义）。
final class LocalServer {

    static let shared = LocalServer()

    private var listener: NWListener?
    private(set) var port: UInt16 = 0
    private let queue = DispatchQueue(label: "u.local.server", qos: .userInitiated)

    var onBridge: ((String, [String: String]) -> String)?

    func start() throws {
        let opts = NWParameters.tcp
        opts.allowLocalEndpointReuse = true
        let l = try NWListener(using: opts, on: .any)
        l.newConnectionHandler = { [weak self] conn in
            self?.accept(conn)
        }
        l.stateUpdateHandler = { state in
            if case .ready = state, let p = l.port?.rawValue {
                self.port = p
                NSLog("U local server on 127.0.0.1:\(p)")
            }
        }
        l.start(queue: queue)
        listener = l

        // 等端口就绪（最多 2 秒）
        let deadline = Date().addingTimeInterval(2)
        while port == 0 && Date() < deadline {
            usleep(20_000)
        }
        if port == 0 { throw NSError(domain: "U", code: 1, userInfo: [NSLocalizedDescriptionKey: "本地服务启动失败"]) }
    }

    // MARK: - 连接处理

    private func accept(_ conn: NWConnection) {
        conn.start(queue: queue)
        readRequest(conn, buffer: Data())
    }

    private func readRequest(_ conn: NWConnection, buffer: Data) {
        conn.receive(minimumIncompleteLength: 1, maximumLength: 64 * 1024) { [weak self] data, _, isDone, err in
            guard let self = self else { conn.cancel(); return }
            var buf = buffer
            if let d = data { buf.append(d) }
            if err != nil { conn.cancel(); return }

            if let headEnd = buf.range(of: Data("\r\n\r\n".utf8)) {
                let head = String(data: buf.subdata(in: 0..<headEnd.lowerBound), encoding: .utf8) ?? ""
                var body = buf.subdata(in: headEnd.upperBound..<buf.count)
                let lines = head.components(separatedBy: "\r\n")
                guard let first = lines.first else { conn.cancel(); return }
                let parts = first.split(separator: " ")
                guard parts.count >= 2 else { conn.cancel(); return }
                let method = String(parts[0])
                let target = String(parts[1])

                var headers: [String: String] = [:]
                for l in lines.dropFirst() {
                    if let i = l.firstIndex(of: ":") {
                        let k = l[..<i].trimmingCharacters(in: .whitespaces).lowercased()
                        let v = l[l.index(after: i)...].trimmingCharacters(in: .whitespaces)
                        headers[k] = v
                    }
                }

                let need = Int(headers["content-length"] ?? "0") ?? 0
                if body.count < need {
                    self.readRequest(conn, buffer: buf)
                    return
                }
                if need > 0 { body = body.prefix(need) }

                self.route(method: method, target: target, body: body, conn: conn)
                return
            }

            if isDone { conn.cancel(); return }
            if buf.count > 8 * 1024 * 1024 { conn.cancel(); return }
            self.readRequest(conn, buffer: buf)
        }
    }

    private func route(method: String, target: String, body: Data, conn: NWConnection) {
        guard let comps = URLComponents(string: "http://127.0.0.1" + target) else {
            respond(conn, 400, "text/plain", Data("bad request".utf8)); return
        }
        var query: [String: String] = [:]
        comps.queryItems?.forEach { query[$0.name] = $0.value ?? "" }
        let path = comps.path

        if path.hasPrefix("/bridge/") {
            let name = String(path.dropFirst("/bridge/".count))
            if body.count > 0, let s = String(data: body, encoding: .utf8), !s.isEmpty {
                query["_body"] = s
            }
            let out = onBridge?(name, query) ?? ""
            respond(conn, 200, "application/json; charset=utf-8", Data(out.utf8))
            return
        }

        serveStatic(path: path.isEmpty || path == "/" ? "/index.html" : path, conn: conn)
    }

    private func serveStatic(path: String, conn: NWConnection) {
        let clean = path.removingPercentEncoding ?? path
        let rel = clean.hasPrefix("/") ? String(clean.dropFirst()) : clean
        guard !rel.contains("..") else { respond(conn, 403, "text/plain", Data()); return }

        let base = (Bundle.main.resourceURL ?? Bundle.main.bundleURL).appendingPathComponent("www")
        var file = base.appendingPathComponent(rel)
        if !FileManager.default.fileExists(atPath: file.path) {
            // 目录或不存在 → 回 index.html（单页应用）
            file = base.appendingPathComponent("index.html")
        }
        guard let data = try? Data(contentsOf: file) else {
            respond(conn, 404, "text/plain", Data("not found".utf8)); return
        }
        respond(conn, 200, mime(file.pathExtension), data)
    }

    private func mime(_ ext: String) -> String {
        switch ext.lowercased() {
        case "html", "htm": return "text/html; charset=utf-8"
        case "js", "mjs": return "application/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json": return "application/json; charset=utf-8"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "webp": return "image/webp"
        case "gif": return "image/gif"
        case "svg": return "image/svg+xml"
        case "mp4": return "video/mp4"
        case "mp3": return "audio/mpeg"
        case "woff2": return "font/woff2"
        case "apk": return "application/vnd.android.package-archive"
        default: return "application/octet-stream"
        }
    }

    private func respond(_ conn: NWConnection, _ code: Int, _ type: String, _ body: Data) {
        var head = "HTTP/1.1 \(code) \(code == 200 ? "OK" : "ERR")\r\n"
        head += "Content-Type: \(type)\r\n"
        head += "Content-Length: \(body.count)\r\n"
        head += "Cache-Control: no-store\r\n"
        head += "Access-Control-Allow-Origin: *\r\n"
        head += "Connection: close\r\n\r\n"
        var out = Data(head.utf8)
        out.append(body)
        conn.send(content: out, completion: .contentProcessed { _ in conn.cancel() })
    }
}
