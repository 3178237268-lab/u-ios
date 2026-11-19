import Foundation
import UIKit

/// 设备信息 + 局域网找服务器（对应安卓的 Discovery）。
final class Device {

    private let key = "u-server"

    func info() -> String {
        let d = UIDevice.current
        let app = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
        return jsonString([
            "model": d.model,
            "brand": "Apple",
            "os": "\(d.systemName) \(d.systemVersion)",
            "app": app
        ])
    }

    func refreshInfo() -> String {
        let maxRate = UIScreen.main.maximumFramesPerSecond
        return jsonString([
            "rate": maxRate,
            "asked": maxRate,
            "modes": [maxRate]
        ])
    }

    func localIp() -> String {
        var addr = "127.0.0.1"
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return addr }
        defer { freeifaddrs(ifaddr) }
        for p in sequence(first: first, next: { $0.pointee.ifa_next }) {
            let i = p.pointee
            guard i.ifa_addr?.pointee.sa_family == UInt8(AF_INET) else { continue }
            let name = String(cString: i.ifa_name)
            if name != "en0" && name != "en1" { continue }
            var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            if getnameinfo(i.ifa_addr, socklen_t(i.ifa_addr.pointee.sa_len),
                           &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST) == 0 {
                addr = String(cString: host)
                break
            }
        }
        return addr
    }

    func discoveredServer() -> String {
        return UserDefaults.standard.string(forKey: key) ?? ""
    }

    /// 扫一遍常见网段找 8787 端口（最多约 6 秒）
    func rescanServer() -> String {
        let myIp = localIp()
        let parts = myIp.split(separator: ".")
        guard parts.count == 4 else { return "" }
        let prefix = "\(parts[0]).\(parts[1]).\(parts[2])."
        let sem = DispatchSemaphore(value: 0)
        var found = ""
        let lock = NSLock()
        let group = DispatchGroup()

        for i in 1...254 {
            let host = prefix + String(i)
            guard let url = URL(string: "http://\(host):8787/api/config") else { continue }
            var req = URLRequest(url: url)
            req.timeoutInterval = 0.6
            group.enter()
            URLSession.shared.dataTask(with: req) { data, _, _ in
                defer { group.leave() }
                if data != nil {
                    lock.lock()
                    if found.isEmpty { found = "http://\(host):8787" }
                    lock.unlock()
                }
            }.resume()
        }
        DispatchQueue.global().async {
            _ = group.wait(timeout: .now() + 6)
            sem.signal()
        }
        _ = sem.wait(timeout: .now() + 7)

        if !found.isEmpty { UserDefaults.standard.set(found, forKey: key) }
        return found
    }
}
