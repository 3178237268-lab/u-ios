# U · iOS 版（ipa）

前端和安卓完全共用同一份 `index.html`（仓库根目录那份），这个目录只负责 iOS 外壳：
`WKWebView` 加载 Bundle 里的 `www/index.html`，页面自己用 localStorage 里的 `u-server` 连局域网服务器。

## 为什么 Windows 上出不了能直接装的 ipa
ipa 里的可执行文件是 **arm64 的 Mach-O**，只有苹果工具链（Xcode / clang + iOS SDK）能生成，
Windows 没有这套东西，所以这里不能像安卓那样本地 aapt2+d8 直接捏一个出来。
两条可行路径都写好了，选一条：

## 路径 A：在 mac 上一条命令（推荐给有 Mac 的人）
```bash
brew install xcodegen
cd ios-u
./build-ipa.sh                 # 出 dist/U-1.75-unsigned.ipa（未签名）
DEVELOPMENT_TEAM=你的团队ID ./build-ipa.sh sign   # 出已签名 dist/U-1.75.ipa
```

## 路径 B：GitHub Actions 的 macOS 机器（Windows 也能用，免费额度够）
把仓库推上 GitHub → Actions 里跑 `build-ipa` → 下载 artifact `U-ipa-unsigned`，得到未签名 ipa。
再在 Windows 上装 **Sideloadly / AltStore**，用你自己的 Apple ID 给它签名并装进 iPhone：
1. Sideloadly 选 ipa、填 Apple ID、点 Start；
2. iPhone 设置 → 通用 → VPN与设备管理 → 信任你的开发者证书；
3. 免费 Apple ID 签名 7 天有效，到期重新签一次（App 内数据不丢）。

## 包信息
- Bundle ID：`com.trae.u`（和安卓 `com.trae.u` 对齐）
- 版本：1.75 / build 76（改版本只改 `ios-u/U/Info.plist`）
- 最低系统：iOS 14.0；仅竖屏；允许 http 明文（局域网服务器是 http）
- 相册/相机/麦克风/本地网络权限说明已写好（发图、发视频、发现服务器要用）
