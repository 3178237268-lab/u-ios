import UIKit
import WebKit

/// U 的 iOS 外壳：加载打包在 Bundle 里的 www/index.html（与安卓 assets/www 同一份前端）。
/// 前端自己会用 localStorage 里的 u-server 连局域网里的 U 服务器，所以这里只做容器。
final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {

    private var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.02, green: 0.02, blue: 0.03, alpha: 1)

        let conf = WKWebViewConfiguration()
        conf.allowsInlineMediaPlayback = true
        conf.mediaTypesRequiringUserActionForPlayback = []
        conf.preferences.javaScriptEnabled = true
        conf.setValue(true, forKey: "allowUniversalAccessFromFileURLs")
        conf.setValue(true, forKey: "allowFileAccessFromFileURLs")

        webView = WKWebView(frame: view.bounds, configuration: conf)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        view.addSubview(webView)

        loadBundledPage()
    }

    private func loadBundledPage() {
        guard let dir = Bundle.main.url(forResource: "www", withExtension: nil) else {
            showFatal("没有找到 www 目录")
            return
        }
        let index = dir.appendingPathComponent("index.html")
        webView.loadFileURL(index, allowingReadAccessTo: dir)
    }

    private func showFatal(_ msg: String) {
        let label = UILabel(frame: view.bounds)
        label.text = msg
        label.textColor = .white
        label.textAlignment = .center
        label.numberOfLines = 0
        view.addSubview(label)
    }

    // 外链用系统浏览器打开，其余留在应用内
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url,
           let scheme = url.scheme?.lowercased(),
           scheme == "http" || scheme == "https",
           navigationAction.navigationType == .linkActivated,
           !url.isFileURL,
           !(url.host ?? "").isEmpty,
           url.absoluteString.contains("127.0.0.1") == false {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    // target="_blank" / window.open → 同一页面加载
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url { webView.load(URLRequest(url: url)) }
        return nil
    }

    override var prefersStatusBarHidden: Bool { false }
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
}
