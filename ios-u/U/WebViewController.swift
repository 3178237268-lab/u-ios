import UIKit
import WebKit
import Photos
import AVFoundation

final class WebViewController: UIViewController, WKUIDelegate, WKNavigationDelegate {

    private var webView: WKWebView!
    private let bridge = Bridge()
    private var askedPermission = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black

        do {
            try LocalServer.shared.start()
        } catch {
            NSLog("本地服务启动失败: \(error)")
        }

        let cfg = WKWebViewConfiguration()
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = []
        // 页面本身就走 http://127.0.0.1，不需要任何 file:// 放宽

        let ucc = WKUserContentController()
        if let jsPath = Bundle.main.path(forResource: "Bridge", ofType: "js"),
           let js = try? String(contentsOfFile: jsPath, encoding: .utf8) {
            ucc.addUserScript(WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        cfg.userContentController = ucc

        webView = WKWebView(frame: view.bounds, configuration: cfg)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.uiDelegate = self
        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        view.addSubview(webView)

        bridge.webView = webView
        bridge.host = self

        let url = URL(string: "http://127.0.0.1:\(LocalServer.shared.port)/index.html")!
        webView.load(URLRequest(url: url))
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
    override var prefersHomeIndicatorAutoHidden: Bool { true }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // 进 App 后只问一次相册 + 相机；拒绝就按用户要求直接退出
        guard !askedPermission else { return }
        askedPermission = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) { [weak self] in
            self?.askPermissions()
        }
    }

    private func askPermissions() {
        let media = Media()
        media.requestPermission { okPhoto in
            AVCaptureDevice.requestAccess(for: .video) { okCam in
                if !okPhoto || !okCam {
                    DispatchQueue.main.async {
                        let alert = UIAlertController(title: "需要相册和相机权限",
                                                      message: "没有这两项权限 U 无法运行，正在退出。",
                                                      preferredStyle: .alert)
                        alert.addAction(UIAlertAction(title: "好", style: .default) { _ in
                            exit(0)
                        })
                        self.present(alert, animated: true)
                    }
                }
            }
        }
    }

    // 让 target=_blank / window.open 也在同一个 WebView 里打开
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let u = navigationAction.request.url { webView.load(URLRequest(url: u)) }
        return nil
    }
}
