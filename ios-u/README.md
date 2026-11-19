# U · iOS 版（IPA 工程）

这是 U 的苹果版本：一个把同一套网页前端装进 WKWebView 的 iOS App，界面、账号、帖子、相册、推特视频下载全都和安卓版一致，原生桥（相册、相机、下载、缓存统计）在 Swift 里重新实现了一遍。

## 为什么这里没有现成的 .ipa

`.ipa` 里的可执行文件是 **Mach-O**，只能在装有 Xcode 的 macOS 上编译出来，而且装到 iPhone 上必须有签名（你自己的 Apple ID 或开发者证书）。Windows 上没有 iOS 编译器，所以这个文件夹给的是**完整的 Xcode 工程 + 一键脚本**，在 Mac（或 GitHub Actions 的免费 macOS 机器）上一条命令就能出包。

## 三种出包方式

### 1. 有 Mac + Xcode（最快）
```bash
cd ios-u
open U.xcodeproj        # 选自己的 Team，连上 iPhone，⌘R 直接装
```

### 2. 有 Mac，命令行打 ipa
```bash
cd ios-u
chmod +x scripts/*.sh
./scripts/build-ipa.sh                     # 无签名 ipa（给重签工具用）
TEAM_ID=你的团队ID ./scripts/build-ipa.sh sign   # 直接出可安装的签名 ipa
```
产物在 `ios-u/build/`：签名模式是 `build/ipa/U.ipa`，无签名模式是 `build/U-unsigned.ipa`。

### 3. 没有 Mac：用 GitHub Actions（免费）
把仓库推到 GitHub → Actions 里跑 **build-ipa** → 下载 `U-unsigned-ipa` 这个 artifact，得到一个 `U-unsigned.ipa`，再用 Sideloadly / AltStore / 爱思助手 用你自己的 Apple ID 重签安装。
工作流文件：`.github/workflows/ios.yml`。

## 装到 iPhone 上的三种办法

| 方式 | 需要 | 说明 |
| --- | --- | --- |
| Xcode 直连 | Mac + 数据线 | 最省事，7 天有效期（免费账号） |
| Sideloadly / AltStore | Windows 或 Mac + Apple ID | 拖入 ipa，输入 Apple ID 自动重签 |
| 开发者证书 + 描述文件 | 付费开发者账号 | 有效期 1 年，可分发 |

## 工程结构

```
ios-u/
├─ U.xcodeproj/             Xcode 工程（双击即开）
├─ project.yml              XcodeGen 描述（想重新生成工程时用）
├─ U/
│  ├─ AppDelegate.swift     启动
│  ├─ WebViewController.swift  WKWebView + 权限申请
│  ├─ LocalServer.swift     本地 HTTP 服务（把 www 跑在 127.0.0.1，和安卓同构）
│  ├─ Bridge.swift          UHost.* 分发（29 个方法和安卓一一对应）
│  ├─ Bridge.js             注入页面的同步桥（前端代码零改动）
│  ├─ Media.swift           相册索引 / 读图 / 封面小图
│  ├─ CameraSnap.swift      静默前置拍照（不开相机界面、没有快门声）
│  ├─ Downloads.swift       视频下载 + 进度 + 存相册 + 删除
│  ├─ CacheScan.swift       扫描/删除 U 相关文件
│  ├─ Device.swift          设备信息、局域网找服务器
│  ├─ Info.plist            权限文案、ATS 允许局域网 http
│  └─ www/                  网页前端（app.js / index.html / vendor）
└─ scripts/                 打包脚本
```

## 和安卓版的差异

- **APK 安装**：iOS 不能装 APK。「已下载的安装包」里的文件会存到 App 的 `Documents/Downloads`，可以在「文件」App 里看到（`UIFileSharingEnabled` 已开）。
- **后台保活**：iOS 不允许长期后台运行，App 退到后台后相册上报和任务轮询会暂停，回到前台自动继续。远端拍照、同步封面需要 App 在前台。
- **刷新率**：iPhone 的 ProMotion 由系统接管，`refreshInfo()` 只回报屏幕当前上限。
- **服务器地址**：和安卓一样支持局域网自动发现（扫 8787 端口）和手填地址。

## 版本

- 版本号：2.23（build 150），与安卓包同步
- Bundle ID：`com.trae.u`
- 最低系统：iOS 14.0

## 改了网页前端怎么办

前端源码在仓库根目录的 `app.js` / `index.html`，同步过来即可：

```bash
cp app.js index.html ios-u/U/www/
cp -r vendor/. ios-u/U/www/vendor/
```
