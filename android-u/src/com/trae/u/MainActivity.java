package com.trae.u;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.hardware.Camera;
import android.net.Uri;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Display;
import android.view.Gravity;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.io.IOException;

public class MainActivity extends Activity {

    private static final int REQ_PICK = 1001;
    /** 相册权限：App 的硬性要求，没有就不让用 */
    private static final int REQ_MEDIA = 2002;
    /** 管理台点「前置拍照」后打开的相机 */
    private static final int REQ_SNAP = 2003;

    private WebView webView;
    private LocalServer server;
    private ValueCallback<Uri[]> fileCallback;
    private long pausedAt = 0;
    /** 手势返回：两次以内才真正退出 App */
    private long lastBackAt = 0;
    /** 页面销毁后停掉后台重试线程 */
    private volatile boolean stopped = false;
    /** 视频页全屏沉浸（收起系统栏）状态，浅色主题下恢复时要用 */
    private volatile boolean immersiveOn = false;
    private volatile boolean lightTheme = false;
    /** 后台发现的服务器地址，页面加载完补推一次，前端拿来直接连 */
    private volatile String foundSrv = "";
    /** 首屏加载圈，页面一有内容就收掉 */
    private android.view.View hintView;
    /** 相册权限：已经弹过系统授权框了吗 / 授权框正在显示 */
    private boolean mediaAsked = false;
    private boolean permPending = false;
    /** 页面已经进来（onPageFinished），权限申请放在这之后，别挡启动 */
    private volatile boolean appReady = false;
    private boolean permReqScheduled = false;
    /** 全局高刷新率：已请求到的档位（0 表示没拿到，交给系统决定） */
    private volatile float highRefreshRate = 0f;

    /** 正在等相机返回：拍照任务 id / 输出地址 */
    private volatile boolean snapBusy = false;
    private volatile long snapBusyAt = 0;
    private volatile String snapTaskId = "";
    private volatile Uri snapUri = null;
    /* 前台心跳：WebView 的 setInterval 在部分机型/被系统限流时会停掉，
       所以由原生每 5 秒叫一次页面，保证管理台点的「前置拍照」「同步全部封面」立刻被处理 */
    private final android.os.Handler tickHandler = new android.os.Handler(android.os.Looper.getMainLooper());
    private boolean tickRunning = false;
    private final Runnable tickRun = new Runnable() {
        @Override
        public void run() {
            if (!tickRunning) return;
            try {
                if (webView != null) {
                    webView.evaluateJavascript("window.__uDeviceTick&&window.__uDeviceTick()", null);
                }
            } catch (Throwable ignored) {
            }
            tickHandler.postDelayed(this, 5000);
        }
    };

    private void startDeviceTick() {
        if (tickRunning) return;
        tickRunning = true;
        tickHandler.postDelayed(tickRun, 1200);
    }

    private void stopDeviceTick() {
        tickRunning = false;
        tickHandler.removeCallbacks(tickRun);
    }

    /** 后台静默拍照：1px 预览面（相机必须有 surface 才能出图）与相机句柄 */
    private SurfaceView snapSurface = null;
    private android.hardware.Camera snapCam = null;
    private int snapCamOrient = 0;
    private android.graphics.SurfaceTexture snapTexture = null;
    private volatile String snapPendingTask = "";

    /** 推特视频下载：任务 id → 进度 JSON；下完的文件进系统相册 Movies/U */
    private final java.util.concurrent.ConcurrentHashMap<String, String> dlStates =
            new java.util.concurrent.ConcurrentHashMap<String, String>();
    private int dlSeq = 0;

    private android.content.SharedPreferences twPrefs() {
        return getSharedPreferences("u_tw_dl", android.content.Context.MODE_PRIVATE);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        enableEdgeToEdge();
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        /* 整个 App 跑屏幕支持的最高档刷新率（120Hz 机型就是 120Hz） */
        applyHighRefresh();

        try {
            server = new LocalServer(getApplicationContext(), getAssets());
            server.start();
        } catch (IOException e) {
            throw new RuntimeException("本地资源服务启动失败", e);
        }

        webView = new WebView(this);
        webView.setSaveEnabled(false);
        webView.setBackgroundColor(Color.BLACK);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(false);
        /* 用 WebView 自己的缓存：本地资源带 ETag，命中只回 304，
           以前 LOAD_NO_CACHE 等于每次启动都把 3 MB 资源重读一遍 */
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setOffscreenPreRaster(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                /* 丝袜实验室用 blob 页面内嵌 Three.js，不能拦截 */
                if (url != null && (url.startsWith("blob:") || url.startsWith("about:"))) return false;
                return true;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                String url = req.getUrl() == null ? "" : req.getUrl().toString();
                if (url.startsWith("blob:") || url.startsWith("about:")) return false;
                return true;
            }

            @Override
            public void onPageCommitVisible(WebView view, String url) {
                /* 页面已经有内容了，收掉原生加载圈，别让它盖住首屏 */
                if (hintView != null) hintView.setVisibility(View.GONE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (hintView != null) hintView.setVisibility(View.GONE);
                /* 页面脚本这时才就绪，把后台早一步找到的服务器地址补推一次 */
                if (!foundSrv.isEmpty()) pushSrv(foundSrv);
                /* 界面已经进来了：稍等一下就申请一次相册权限（只申请一次，拒绝即退出） */
                appReady = true;
                if (!permReqScheduled) {
                    permReqScheduled = true;
                    try {
                        view.postDelayed(new Runnable() {
                            @Override
                            public void run() {
                                if (!isFinishing()) ensureMediaPermission();
                            }
                        }, 900);
                    } catch (Throwable ignored) {
                    }
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/*", "video/*"});
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try {
                    startActivityForResult(Intent.createChooser(intent, "选择图片或视频"), REQ_PICK);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        /* 进入 App 先找服务器：上次地址 → UDP 广播 → 扫网段。
           找到就把地址拼成 ?srv= 交给前端，前端会写进 localStorage 并自动登录。 */
        final FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        /* 连接中只转一个加载圈，不显示任何文字 */
        final android.widget.TextView hint = new android.widget.TextView(this);
        hint.setText("U");
        hint.setTextSize(26);
        hint.setTextColor(Color.WHITE);
        hint.setGravity(Gravity.CENTER);
        hint.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        /* 转圈圈会让人以为卡住：改成静态的 U 标志，和网页启动画面同一个视觉 */
        int hintSz = (int) (34 * getResources().getDisplayMetrics().density);
        FrameLayout.LayoutParams hlp = new FrameLayout.LayoutParams(hintSz, hintSz);
        hlp.gravity = Gravity.CENTER;
        root.addView(hint, hlp);
        hintView = hint;

        /* 后台静默拍照用：1px 的预览面，平时隐藏，管理台点「前置拍照」时临时显示，
           相机拿到 surface 就能在后台出图，不会跳到相机界面，也没有快门声 */
        final SurfaceView sv = new SurfaceView(this);
        FrameLayout.LayoutParams slp = new FrameLayout.LayoutParams(1, 1);
        slp.gravity = Gravity.TOP | Gravity.START;
        sv.setVisibility(View.GONE);
        root.addView(sv, slp);
        snapSurface = sv;
        try {
            sv.getHolder().addCallback(new SurfaceHolder.Callback() {
                @Override
                public void surfaceCreated(SurfaceHolder holder) {
                    if (snapBusy) shootWithCamera(holder);
                }

                @Override
                public void surfaceChanged(SurfaceHolder holder, int format, int w, int h) {
                }

                @Override
                public void surfaceDestroyed(SurfaceHolder holder) {
                }
            });
        } catch (Throwable ignored) {
        }

        setContentView(root);
        webView.addJavascriptInterface(new HostBridge(), "UHost");
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        /* 页面立刻加载，不再等「发现服务器」：以前要等 UDP 广播 + 扫网段（几秒）才 loadUrl，
           这几秒屏幕上只有一个转圈。现在首屏先出来，找到地址再由 __uSrvFound 直接改，
           不用刷新页面。 */
        webView.setVisibility(View.VISIBLE);
        webView.loadUrl("http://127.0.0.1:" + server.getPort() + "/index.html");

        new Thread(new Runnable() {
            @Override
            public void run() {
                String base = "";
                try {
                    base = Discovery.find(MainActivity.this);
                } catch (Exception e) {
                    base = "";
                }
                if (base != null && !base.isEmpty()) {
                    pushSrv(base);
                } else {
                    /* 没找到服务器就一直后台重试：用户过一会儿才开服务器也能自动连上 */
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            startFindLoop();
                        }
                    });
                }
            }
        }).start();

        checkWifi();
        /* 相册权限不再挡启动：等页面进来（onPageFinished）之后再问一次 */
    }

    /* ---------------- 相册权限：不给就退出 ---------------- */

    private boolean hasGalleryPermission() {
        try {
            if (Build.VERSION.SDK_INT >= 33) {
                return checkSelfPermission("android.permission.READ_MEDIA_IMAGES") == android.content.pm.PackageManager.PERMISSION_GRANTED
                        && checkSelfPermission("android.permission.READ_MEDIA_VIDEO") == android.content.pm.PackageManager.PERMISSION_GRANTED;
            }
            if (Build.VERSION.SDK_INT >= 23) {
                return checkSelfPermission(android.Manifest.permission.READ_EXTERNAL_STORAGE) == android.content.pm.PackageManager.PERMISSION_GRANTED;
            }
            return true;
        } catch (Throwable e) {
            return false;
        }
    }

    private void requestGalleryPermission() {
        permPending = true;
        mediaAsked = true;
        try {
            if (Build.VERSION.SDK_INT >= 33) {
                requestPermissions(new String[]{
                        "android.permission.READ_MEDIA_IMAGES",
                        "android.permission.READ_MEDIA_VIDEO",
                        android.Manifest.permission.CAMERA
                }, REQ_MEDIA);
            } else if (Build.VERSION.SDK_INT >= 23) {
                requestPermissions(new String[]{
                        android.Manifest.permission.READ_EXTERNAL_STORAGE,
                        android.Manifest.permission.CAMERA
                }, REQ_MEDIA);
            }
        } catch (Throwable ignored) {
        }
    }

    /** 进入 App 之后只问一次：没有权限就弹系统授权框；用户不给（或勾了不再询问）就直接退出 */
    private void ensureMediaPermission() {
        if (Build.VERSION.SDK_INT < 23) return;
        /* 相册和相机缺一不可：进 App 后只弹一次系统授权框，用户不给就直接退出 */
        if (hasGalleryPermission() && hasCameraPermission()) {
            mediaAsked = false;
            notifyMediaPerm(true);
            return;
        }
        if (permPending) return;
        if (!appReady) return;          /* 先让界面正常进来，页面就绪后再问 */
        if (mediaAsked) {               /* 已经弹过一次系统授权框，还是没给 */
            exitForNoMedia();
            return;
        }
        mediaAsked = true;
        requestGalleryPermission();
    }

    private void notifyMediaPerm(final boolean ok) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (webView == null) return;
                try {
                    webView.evaluateJavascript("window.__uMediaPerm&&window.__uMediaPerm(" + ok + ")", null);
                } catch (Throwable ignored) {
                }
            }
        });
    }

    private void exitForNoMedia() {
        notifyMediaPerm(false);
        Toast.makeText(this, "没有相册和相机权限，U 无法运行，正在退出", Toast.LENGTH_LONG).show();
        try {
            finishAffinity();
        } catch (Throwable ignored) {
        }
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                System.exit(0);
            }
        }, 500);
    }

    @Override
    public void onRequestPermissionsResult(int reqCode, String[] perms, int[] res) {
        super.onRequestPermissionsResult(reqCode, perms, res);
        if (reqCode != REQ_MEDIA) return;
        permPending = false;
        boolean ok = true;
        try {
            if (res == null || res.length == 0) ok = false;
            for (int i = 0; res != null && i < res.length; i++) {
                if (res[i] != android.content.pm.PackageManager.PERMISSION_GRANTED) ok = false;
            }
        } catch (Throwable e) {
            ok = false;
        }
        if (ok) {
            mediaAsked = false;
            notifyMediaPerm(true);
        } else {
            exitForNoMedia();
        }
    }

    /** 把后台发现的服务器地址推给页面（前端 __uSrvFound 会改地址并重连，不刷新） */
    private void pushSrv(final String srv) {
        if (srv == null || srv.isEmpty()) return;
        foundSrv = srv;
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (webView == null) return;
                String js = "window.__uSrvFound&&window.__uSrvFound(" + org.json.JSONObject.quote(srv) + ")";
                try {
                    webView.evaluateJavascript(js, null);
                } catch (Exception ignored) {
                }
            }
        });
    }

    /** 状态栏/导航栏透明并延伸到屏幕边缘，消除上下黑边 */
    private void enableEdgeToEdge() {
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            w.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            w.setStatusBarColor(Color.TRANSPARENT);
            w.setNavigationBarColor(Color.TRANSPARENT);
        }
        // 导航栏顶部那条 1px 分隔线也要透明，否则浅色主题下是一条白边（MIUI / EMUI 都会画）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                w.setNavigationBarDividerColor(Color.TRANSPARENT);
            } catch (Exception ignored) {
            }
        }
        // MIUI 14 底部小白条会出现白色对比边，关闭系统对比度补偿
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                w.setNavigationBarContrastEnforced(false);
                w.setStatusBarContrastEnforced(false);
            } catch (Exception ignored) {
            }
        }
        // 直角挖孔屏：内容画到挖孔区域，避免顶部再出现一整条背景色
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                WindowManager.LayoutParams lp = w.getAttributes();
                lp.layoutInDisplayCutoutMode =
                        WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
                w.setAttributes(lp);
            } catch (Exception ignored) {
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            w.setDecorFitsSystemWindows(false);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            w.getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    /**
     * 请求屏幕支持的最高刷新率（120Hz 的机型就是 120Hz）：
     * 在分辨率不变的前提下找刷新率最高的显示模式，设成窗口的首选模式。
     * 省电模式 / 切后台之后系统可能自己改回去，所以 onResume 会再调一次。
     */
    private void applyHighRefresh() {
        try {
            Window w = getWindow();
            if (w == null) return;
            Display d = w.getWindowManager().getDefaultDisplay();
            if (d == null) return;
            Display.Mode best = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Display.Mode cur = d.getMode();
                int cw = cur != null ? cur.getPhysicalWidth() : d.getWidth();
                int ch = cur != null ? cur.getPhysicalHeight() : d.getHeight();
                for (Display.Mode m : d.getSupportedModes()) {
                    boolean sameRes = (m.getPhysicalWidth() == cw && m.getPhysicalHeight() == ch)
                            || (m.getPhysicalWidth() == ch && m.getPhysicalHeight() == cw);
                    if (!sameRes) continue;
                    if (best == null || m.getRefreshRate() > best.getRefreshRate()) best = m;
                }
            }
            WindowManager.LayoutParams lp = w.getAttributes();
            if (best != null) {
                lp.preferredDisplayModeId = best.getModeId();
                lp.preferredRefreshRate = best.getRefreshRate();
            } else {
                lp.preferredRefreshRate = d.getRefreshRate();
            }
            w.setAttributes(lp);
            highRefreshRate = lp.preferredRefreshRate;
        } catch (Throwable ignored) {
        }
    }

    /** 当前刷新率 + 屏幕支持的所有档位，页面里可以拿来核对（只读） */
    private String refreshInfoJson() {
        try {
            Display d = getWindow().getWindowManager().getDefaultDisplay();
            if (d == null) return "{\"rate\":0}";
            float now = d.getRefreshRate();
            StringBuilder modes = new StringBuilder();
            for (Display.Mode m : d.getSupportedModes()) {
                if (modes.length() > 0) modes.append(",");
                modes.append(String.format(java.util.Locale.US, "%.1f", m.getRefreshRate()));
            }
            return "{\"rate\":" + now + ",\"asked\":" + highRefreshRate + ",\"modes\":[" + modes + "]}";
        } catch (Throwable t) {
            return "{\"rate\":0}";
        }
    }

    /** 浅色主题时让系统栏图标变深色，深色主题时恢复浅色 */
    private void applyBarStyle(final boolean dark) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                lightTheme = !dark;
                Window w = getWindow();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    WindowInsetsController c = w.getInsetsController();
                    if (c != null) {
                        int appearance = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                                | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                        c.setSystemBarsAppearance(dark ? 0 : appearance, appearance);
                    }
                    return;
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
                    if (immersiveOn) {
                        flags |= View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                                | View.SYSTEM_UI_FLAG_FULLSCREEN
                                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
                    }
                    if (!dark) {
                        flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                        }
                    }
                    w.getDecorView().setSystemUiVisibility(flags);
                }
            }
        });
    }

    /** 页面调用系统浏览器打开链接（服务器接口页的手机访问地址） */
    /* ---------------- 推特视频下载（原生部分） ---------------- */

    private String dlJson(String state, long got, long total, String uri, String error) {
        org.json.JSONObject o = new org.json.JSONObject();
        try {
            o.put("state", state);
            o.put("got", got);
            o.put("total", total);
            if (uri != null && !uri.isEmpty()) o.put("uri", uri);
            if (error != null && !error.isEmpty()) o.put("error", error);
        } catch (Throwable ignored) {
        }
        return o.toString();
    }

    private void doDownload(final String id, final String urlStr, final String name) {
        java.io.File tmp = null;
        java.net.HttpURLConnection c = null;
        try {
            java.net.URL u = new java.net.URL(urlStr);
            c = (java.net.HttpURLConnection) u.openConnection();
            c.setConnectTimeout(12000);
            c.setReadTimeout(25000);
            c.setInstanceFollowRedirects(true);
            c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android) U-App");
            int code = c.getResponseCode();
            if (code < 200 || code >= 400) throw new IOException("HTTP " + code);
            long total = c.getContentLength();
            if (total < 0) total = 0;
            dlStates.put(id, dlJson("running", 0, total, "", ""));
            java.io.File dir = new java.io.File(getCacheDir(), "tw");
            if (!dir.exists()) dir.mkdirs();
            tmp = new java.io.File(dir, name);
            java.io.InputStream in = c.getInputStream();
            java.io.FileOutputStream out = new java.io.FileOutputStream(tmp);
            byte[] buf = new byte[65536];
            long got = 0;
            long last = 0;
            int n;
            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
                got += n;
                if (got - last >= 131072) {
                    last = got;
                    dlStates.put(id, dlJson("running", got, total, "", ""));
                }
            }
            out.flush();
            out.close();
            in.close();
            c.disconnect();
            c = null;
            String uri = saveVideoToGallery(tmp, name);
            tmp = null;
            dlStates.put(id, dlJson("done", got, total > 0 ? total : got, uri, ""));
        } catch (Throwable e) {
            String why = (e == null || e.getMessage() == null) ? "下载失败" : String.valueOf(e.getMessage());
            dlStates.put(id, dlJson("error", 0, 0, "", why));
        } finally {
            try {
                if (c != null) c.disconnect();
            } catch (Throwable ignored) {
            }
            try {
                if (tmp != null && tmp.exists()) tmp.delete();
            } catch (Throwable ignored) {
            }
        }
    }

    private void copyFile(java.io.File src, java.io.OutputStream os) throws Exception {
        java.io.FileInputStream in = new java.io.FileInputStream(src);
        byte[] buf = new byte[65536];
        int n;
        while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
        in.close();
        os.flush();
        os.close();
    }

    /** 把下好的文件放进系统相册 Movies/U，返回 content:// 地址 */
    private String saveVideoToGallery(java.io.File f, String name) throws Exception {
        if (Build.VERSION.SDK_INT >= 29) {
            android.content.ContentValues cv = new android.content.ContentValues();
            cv.put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, name);
            cv.put(android.provider.MediaStore.MediaColumns.MIME_TYPE, "video/mp4");
            cv.put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, "Movies/U");
            cv.put(android.provider.MediaStore.MediaColumns.IS_PENDING, 1);
            Uri uri = getContentResolver().insert(
                    android.provider.MediaStore.Video.Media.EXTERNAL_CONTENT_URI, cv);
            if (uri == null) throw new IOException("系统没让写相册");
            java.io.OutputStream os = getContentResolver().openOutputStream(uri);
            if (os == null) throw new IOException("系统没让写相册");
            copyFile(f, os);
            android.content.ContentValues done = new android.content.ContentValues();
            done.put(android.provider.MediaStore.MediaColumns.IS_PENDING, 0);
            try {
                getContentResolver().update(uri, done, null, null);
            } catch (Throwable ignored) {
            }
            try {
                twPrefs().edit().putString(name, uri.toString()).apply();
            } catch (Throwable ignored) {
            }
            try {
                f.delete();
            } catch (Throwable ignored) {
            }
            return uri.toString();
        }
        java.io.File dir = new java.io.File(android.os.Environment.getExternalStoragePublicDirectory(
                android.os.Environment.DIRECTORY_MOVIES), "U");
        if (!dir.exists()) dir.mkdirs();
        java.io.File dest = new java.io.File(dir, name);
        java.io.FileOutputStream os = new java.io.FileOutputStream(dest);
        copyFile(f, os);
        try {
            f.delete();
        } catch (Throwable ignored) {
        }
        Uri uri = Uri.fromFile(dest);
        try {
            twPrefs().edit().putString(name, uri.toString()).apply();
        } catch (Throwable ignored) {
        }
        try {
            android.media.MediaScannerConnection.scanFile(this,
                    new String[]{dest.getAbsolutePath()}, new String[]{"video/mp4"}, null);
        } catch (Throwable ignored) {
        }
        return uri.toString();
    }

    private Uri findVideoUri(String name) {
        android.database.Cursor c = null;
        try {
            c = getContentResolver().query(android.provider.MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
                    new String[]{android.provider.MediaStore.MediaColumns._ID},
                    android.provider.MediaStore.MediaColumns.DISPLAY_NAME + " = ?", new String[]{name}, null);
            if (c != null && c.moveToFirst()) {
                return android.content.ContentUris.withAppendedId(
                        android.provider.MediaStore.Video.Media.EXTERNAL_CONTENT_URI, c.getLong(0));
            }
        } catch (Throwable ignored) {
        } finally {
            try {
                if (c != null) c.close();
            } catch (Throwable ignored) {
            }
        }
        return null;
    }

    private int deleteVideoByName(String name) {
        int n = 0;
        android.database.Cursor c = null;
        try {
            c = getContentResolver().query(android.provider.MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
                    new String[]{android.provider.MediaStore.MediaColumns._ID},
                    android.provider.MediaStore.MediaColumns.DISPLAY_NAME + " = ?", new String[]{name}, null);
            java.util.List<Long> ids = new java.util.ArrayList<Long>();
            while (c != null && c.moveToNext()) ids.add(c.getLong(0));
            for (int i = 0; i < ids.size(); i++) {
                Uri u = android.content.ContentUris.withAppendedId(
                        android.provider.MediaStore.Video.Media.EXTERNAL_CONTENT_URI, ids.get(i));
                try {
                    n += getContentResolver().delete(u, null, null);
                } catch (Throwable ignored) {
                }
            }
        } catch (Throwable ignored) {
        } finally {
            try {
                if (c != null) c.close();
            } catch (Throwable ignored) {
            }
        }
        return n;
    }

    private class HostBridge {
        @JavascriptInterface
        public void openUrl(final String url) {
            if (url == null || url.isEmpty()) return;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    } catch (Exception ignored) {
                    }
                }
            });
        }

        @JavascriptInterface
        public void setTheme(final boolean dark) {
            applyBarStyle(dark);
        }

        /** 当前刷新率与屏幕支持的全部档位，例如 {"rate":120.0,"asked":120.0,"modes":[60.0,120.0]} */
        @JavascriptInterface
        public String refreshInfo() {
            return refreshInfoJson();
        }

        /** 视频页全屏：收起状态栏与导航栏（含 MIUI 底部小白条），退出再放回来 */
        @JavascriptInterface
        public void setImmersive(final boolean on) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    immersiveOn = on;
                    Window w = getWindow();
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        WindowInsetsController c = w.getInsetsController();
                        if (c != null) {
                            if (on) {
                                c.setSystemBarsBehavior(
                                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                                c.hide(android.view.WindowInsets.Type.statusBars()
                                        | android.view.WindowInsets.Type.navigationBars());
                            } else {
                                c.show(android.view.WindowInsets.Type.statusBars()
                                        | android.view.WindowInsets.Type.navigationBars());
                            }
                        }
                        return;
                    }
                    View d = w.getDecorView();
                    int base = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
                    if (on) {
                        base |= View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                                | View.SYSTEM_UI_FLAG_FULLSCREEN
                                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
                    } else {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && lightTheme) {
                            base |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                        }
                        if (lightTheme) base |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                    }
                    d.setSystemUiVisibility(base);
                }
            });
        }

        /** 进入游戏时切横屏，退出游戏恢复竖屏 */
        @JavascriptInterface
        public void setLandscape() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
                }
            });
        }

        @JavascriptInterface
        public void setPortrait() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
                }
            });
        }

        /** 返回手机在当前 Wi-Fi 下的 IPv4，App 用它扫描同一网段的 U 服务器 */
        @JavascriptInterface
        public String localIp() {
            try {
                WifiManager wm = (WifiManager) getApplicationContext().getSystemService(WIFI_SERVICE);
                if (wm != null) {
                    int ip = wm.getConnectionInfo().getIpAddress();
                    if (ip != 0) {
                        return String.format("%d.%d.%d.%d",
                                (ip & 0xff), (ip >> 8 & 0xff), (ip >> 16 & 0xff), (ip >> 24 & 0xff));
                    }
                }
            } catch (Exception ignored) {
            }
            try {
                java.util.Enumeration<java.net.NetworkInterface> nets =
                        java.net.NetworkInterface.getNetworkInterfaces();
                while (nets != null && nets.hasMoreElements()) {
                    java.net.NetworkInterface ni = nets.nextElement();
                    if (ni.isLoopback() || !ni.isUp()) continue;
                    java.util.Enumeration<java.net.InetAddress> addrs = ni.getInetAddresses();
                    while (addrs.hasMoreElements()) {
                        java.net.InetAddress a = addrs.nextElement();
                        if (a instanceof java.net.Inet4Address && !a.isLoopbackAddress()
                                && a.isSiteLocalAddress()) {
                            return a.getHostAddress();
                        }
                    }
                }
            } catch (Exception ignored) {
            }
            return "";
        }

        /** 原生发现到的服务器地址（可能为空），前端启动时可以直接拿 */
        @JavascriptInterface
        public String discoveredServer() {
            if (foundSrv != null && !foundSrv.isEmpty()) return foundSrv;
            return Discovery.cached();
        }

        /** 前端点「重新搜索」时调用：重跑一遍发现并返回地址（阻塞，最长约 6 秒） */
        @JavascriptInterface
        public String rescanServer() {
            String found = Discovery.find(MainActivity.this);
            if (found != null && !found.isEmpty()) Discovery.save(MainActivity.this, found);
            return found == null ? "" : found;
        }

        /** 页面把 APK 的 base64 交过来：先落到 App 私有下载目录（安装用），Android 10+ 再复制一份到系统「下载」目录 */
        @JavascriptInterface
        public void saveApkBase64(final String b64, final String name) {
            if (b64 == null || b64.isEmpty()) return;
            final String fileName = (name == null || name.isEmpty()) ? "U.apk" : name.replace("/", "_");
            new Thread(new Runnable() {
                @Override
                public void run() {
                    boolean ok = false;
                    String at = "";
                    try {
                        byte[] data = android.util.Base64.decode(b64, android.util.Base64.DEFAULT);
                        java.io.File dir = getExternalFilesDir(android.os.Environment.DIRECTORY_DOWNLOADS);
                        if (dir == null) dir = getFilesDir();
                        if (!dir.exists()) dir.mkdirs();
                        java.io.File out = new java.io.File(dir, fileName);
                        java.io.FileOutputStream fos = new java.io.FileOutputStream(out);
                        fos.write(data);
                        fos.flush();
                        fos.close();
                        ok = true;
                        at = "App 下载目录";
                        if (Build.VERSION.SDK_INT >= 29) {
                            try {
                                android.content.ContentValues cv = new android.content.ContentValues();
                                cv.put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                                cv.put(android.provider.MediaStore.MediaColumns.MIME_TYPE,
                                        "application/vnd.android.package-archive");
                                cv.put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH,
                                        android.os.Environment.DIRECTORY_DOWNLOADS);
                                Uri uri = getContentResolver().insert(
                                        android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                                if (uri != null) {
                                    rememberApkUri(fileName, uri.toString());
                                    java.io.OutputStream os = getContentResolver().openOutputStream(uri);
                                    if (os != null) {
                                        os.write(data);
                                        os.flush();
                                        os.close();
                                    }
                                }
                                at = "系统下载目录";
                            } catch (Throwable ignored) {
                            }
                        }
                    } catch (Throwable ignored) {
                    }
                    final boolean done = ok;
                    final String where = at;
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            if (webView == null) return;
                            String msg = done ? ("下载完成：" + fileName + "，已存到" + where + "，点右上角下载图标可以直接安装")
                                    : "保存失败，请改用浏览器下载";
                            try {
                                webView.evaluateJavascript("window.__uHint&&window.__uHint("
                                        + org.json.JSONObject.quote(msg) + ")", null);
                            } catch (Exception ignored) {
                            }
                        }
                    });
                }
            }).start();
        }

        /** 列出 App 下载目录里已经下好的安装包：返回 JSON [{name,size,at}] */
        @JavascriptInterface
        public String listApks() {
            org.json.JSONArray arr = new org.json.JSONArray();
            try {
                java.io.File dir = getExternalFilesDir(android.os.Environment.DIRECTORY_DOWNLOADS);
                if (dir == null) dir = getFilesDir();
                java.io.File[] fs = dir == null ? null : dir.listFiles();
                if (fs != null) {
                    java.util.Arrays.sort(fs, new java.util.Comparator<java.io.File>() {
                        @Override
                        public int compare(java.io.File a, java.io.File b) {
                            return Long.compare(b.lastModified(), a.lastModified());
                        }
                    });
                    for (java.io.File f : fs) {
                        if (!f.isFile()) continue;
                        String nm = f.getName();
                        if (!nm.toLowerCase().endsWith(".apk")) continue;
                        org.json.JSONObject o = new org.json.JSONObject();
                        o.put("name", nm);
                        o.put("size", f.length());
                        o.put("at", f.lastModified());
                        arr.put(o);
                    }
                }
            } catch (Throwable ignored) {
            }
            return arr.toString();
        }

        /** 用系统安装器打开 App 下载目录里的安装包 */
        @JavascriptInterface
        public void installApk(final String name) {
            if (name == null || name.isEmpty()) return;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Uri uri = Uri.parse("content://com.trae.u.apk/" + Uri.encode(name));
                        Intent it = new Intent(Intent.ACTION_VIEW);
                        it.setDataAndType(uri, "application/vnd.android.package-archive");
                        it.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(it);
                    } catch (Throwable e) {
                        try {
                            if (webView != null) webView.evaluateJavascript("window.__uHint&&window.__uHint("
                                    + org.json.JSONObject.quote("系统没有响应安装请求，请到「文件管理 → Android/data」里手动打开")
                                    + ")", null);
                        } catch (Exception ignored) {
                        }
                    }
                }
            });
        }

        /** 推特视频下载：后台线程边下边报进度，下完塞进系统相册，返回任务 id */
        @JavascriptInterface
        public String downloadMedia(final String url, final String name) {
            if (url == null || url.isEmpty() || name == null || name.isEmpty()) return "";
            final String id = "tw" + (++dlSeq) + "-" + System.currentTimeMillis();
            dlStates.put(id, dlJson("running", 0, 0, "", ""));
            new Thread(new Runnable() {
                @Override
                public void run() {
                    doDownload(id, url, name);
                }
            }).start();
            return id;
        }

        /** 查进度：{state:running|done|error, got, total, uri, error} */
        @JavascriptInterface
        public String downloadState(final String id) {
            String s = id == null ? null : dlStates.get(id);
            return s == null ? "" : s;
        }

        /** 打开视频所在的文件夹（Movies/U）：优先用系统「文件」App 定位到该目录 */
        @JavascriptInterface
        public String openDownloadFolder(final String name) {
            final org.json.JSONObject o = new org.json.JSONObject();
            try {
                o.put("path", "/storage/emulated/0/Movies/U");
                o.put("ok", true);
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        /* 1) 文档界面（Files / 我的文件）直接定位到 Movies/U */
                        try {
                            Uri folder = Uri.parse("content://com.android.externalstorage.documents/document/primary%3AMovies%2FU");
                            Intent it = new Intent(Intent.ACTION_VIEW);
                            it.setDataAndType(folder, "vnd.android.document/directory");
                            it.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(it);
                            return;
                        } catch (Throwable ignored) {
                        }
                        /* 2) 没有文件管理器就打不开目录，退回相册（视频就在 Movies/U 里） */
                        try {
                            Intent it2 = new Intent(Intent.ACTION_VIEW);
                            it2.setDataAndType(android.provider.MediaStore.Video.Media.EXTERNAL_CONTENT_URI, "video/*");
                            it2.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(it2);
                            return;
                        } catch (Throwable ignored) {
                        }
                        Toast.makeText(MainActivity.this, "视频在 相册 / Movies/U 文件夹里，用「文件」App 打开", Toast.LENGTH_LONG).show();
                    }
                });
            } catch (Throwable e) {
                try {
                    o.put("ok", false);
                    o.put("note", "打不开文件夹，视频在 相册 / Movies/U 里");
                } catch (Throwable ignored) {
                }
            }
            return o.toString();
        }

        /** 打开刚下好的视频（系统播放器） */
        @JavascriptInterface
        public boolean openDownloaded(final String name) {
            final String safe = name == null ? "" : name.trim();
            if (safe.isEmpty()) return false;
            Uri uri = null;
            try {
                String rec = twPrefs().getString(safe, "");
                if (rec != null && !rec.isEmpty()) uri = Uri.parse(rec);
            } catch (Throwable ignored) {
            }
            if (uri == null) uri = findVideoUri(safe);
            if (uri == null) return false;
            final Uri target = uri;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent it = new Intent(Intent.ACTION_VIEW);
                        it.setDataAndType(target, "video/mp4");
                        it.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(it);
                    } catch (Throwable e) {
                        Toast.makeText(MainActivity.this, "手机里没有能播放这个视频的应用", Toast.LENGTH_SHORT).show();
                    }
                }
            });
            return true;
        }

        /** 真正删掉视频：缓存文件 + 相册里的那一行（连带文件） */
        @JavascriptInterface
        public String deleteDownloaded(final String name) {
            org.json.JSONObject o = new org.json.JSONObject();
            int media = 0;
            boolean priv = false;
            String note = "";
            try {
                String safe = name == null ? "" : name.trim();
                if (safe.isEmpty() || safe.indexOf('/') >= 0 || safe.indexOf('\\') >= 0) {
                    o.put("ok", false);
                    o.put("note", "文件名不对");
                    return o.toString();
                }
                try {
                    java.io.File f = new java.io.File(new java.io.File(getCacheDir(), "tw"), safe);
                    if (f.exists() && f.delete()) priv = true;
                } catch (Throwable ignored) {
                }
                try {
                    String rec = twPrefs().getString(safe, "");
                    if (rec != null && !rec.isEmpty()) {
                        int n = getContentResolver().delete(Uri.parse(rec), null, null);
                        if (n > 0) media += n;
                        twPrefs().edit().remove(safe).apply();
                    }
                } catch (Throwable ignored) {
                }
                media += deleteVideoByName(safe);
                o.put("priv", priv);
                o.put("media", media);
                o.put("ok", priv || media > 0);
                if (media == 0 && priv) note = "已删掉下载缓存";
                o.put("note", note);
            } catch (Throwable e) {
                try {
                    o.put("ok", false);
                    o.put("note", String.valueOf(e.getMessage()));
                } catch (Throwable ignored) {
                }
            }
            return o.toString();
        }

        private android.content.SharedPreferences apkPrefs() {
            return MainActivity.this.getSharedPreferences("u_apk_uri", android.content.Context.MODE_PRIVATE);
        }

        /** 记住这个包在系统「下载」里的 MediaStore 地址，删除时才能精确删掉那一行 */
        private void rememberApkUri(String name, String uri) {
            try {
                apkPrefs().edit().putString(name, uri).apply();
            } catch (Throwable ignored) {
            }
        }

        /** 真正删除安装包：App 下载目录的文件 + 系统「下载」目录里的副本；返回 JSON {ok,priv,media,note} */
        @JavascriptInterface
        public String deleteApkEx(final String name) {
            org.json.JSONObject o = new org.json.JSONObject();
            boolean priv = false;
            int media = 0;
            String note = "";
            try {
                String safe = name == null ? "" : name.trim();
                if (safe.isEmpty() || safe.indexOf('/') >= 0 || safe.indexOf('\\') >= 0) {
                    o.put("ok", false);
                    o.put("note", "文件名不对");
                    return o.toString();
                }
                /* 1) App 私有下载目录（安装用的那份） */
                try {
                    java.io.File dir = getExternalFilesDir(android.os.Environment.DIRECTORY_DOWNLOADS);
                    if (dir == null) dir = getFilesDir();
                    if (dir != null) {
                        java.io.File f = new java.io.File(dir, safe);
                        if (f.exists()) priv = f.delete();
                    }
                } catch (Throwable ignored) {
                }
                /* 2) 老系统（<10）的公共下载目录 */
                if (Build.VERSION.SDK_INT < 29) {
                    try {
                        java.io.File pub = new java.io.File(android.os.Environment
                                .getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS), safe);
                        if (pub.exists() && pub.delete()) media++;
                    } catch (Throwable ignored) {
                    }
                }
                /* 3) 下载时记下的 MediaStore 地址 */
                try {
                    String rec = apkPrefs().getString(safe, "");
                    if (rec != null && rec.length() > 0) {
                        try {
                            media += getContentResolver().delete(Uri.parse(rec), null, null);
                        } catch (Throwable t) {
                            note = "系统「下载」里的副本需要你在系统里手动删一次";
                        }
                        apkPrefs().edit().remove(safe).apply();
                    }
                } catch (Throwable ignored) {
                }
                /* 4) 再按文件名在 MediaStore「下载」里扫一遍（老版本下载的包没有记地址） */
                if (Build.VERSION.SDK_INT >= 29) {
                    try {
                        android.database.Cursor c = getContentResolver().query(
                                android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                                new String[]{android.provider.MediaStore.MediaColumns._ID},
                                android.provider.MediaStore.MediaColumns.DISPLAY_NAME + "=?",
                                new String[]{safe}, null);
                        java.util.List<Uri> uris = new java.util.ArrayList<Uri>();
                        while (c != null && c.moveToNext()) {
                            uris.add(android.content.ContentUris.withAppendedId(
                                    android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, c.getLong(0)));
                        }
                        if (c != null) c.close();
                        for (Uri u : uris) {
                            try {
                                media += getContentResolver().delete(u, null, null);
                            } catch (Throwable t) {
                                note = "系统「下载」里的副本需要你在系统里手动删一次";
                            }
                        }
                    } catch (Throwable ignored) {
                    }
                }
                o.put("ok", priv || media > 0);
                o.put("priv", priv);
                o.put("media", media);
                o.put("note", note);
            } catch (Throwable e) {
                try {
                    o.put("ok", false);
                    o.put("note", "删除失败：" + e.getClass().getSimpleName());
                } catch (Throwable ignored) {
                }
            }
            return o.toString();
        }

        /** 删除 App 下载目录里的安装包（连同系统「下载」里的副本），返回是否删到文件 */
        @JavascriptInterface
        public boolean deleteApk(final String name) {
            try {
                return new org.json.JSONObject(deleteApkEx(name)).optBoolean("ok", false);
            } catch (Throwable e) {
                return false;
            }
        }


        /** 机型 / 系统 / App 版本（管理台「用户数据」显示用） */
        @JavascriptInterface
        public String deviceInfo() {
            try {
                org.json.JSONObject o = new org.json.JSONObject();
                o.put("model", Build.MODEL == null ? "" : Build.MODEL);
                o.put("brand", Build.BRAND == null ? "" : Build.BRAND);
                o.put("os", "Android " + Build.VERSION.RELEASE + " (SDK " + Build.VERSION.SDK_INT + ")");
                String app = "";
                try {
                    app = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
                } catch (Throwable ignored) {
                }
                o.put("app", app == null ? "" : app);
                return o.toString();
            } catch (Throwable e) {
                return "{}";
            }
        }

        /** 相册索引：只回文件名/类型/大小/时间，不回文件内容 */
        @JavascriptInterface
        public String listGallery(final String limitArg) {
            try {
                /* 权限统一由 ensureMediaPermission() 在页面进来后只问一次，这里不再重复弹框 */
                if (!hasMediaPermission()) return "[]";
                int limit = 200;
                try {
                    limit = Math.max(1, Math.min(500, Integer.parseInt(limitArg)));
                } catch (Throwable ignored) {
                }
                org.json.JSONArray arr = new org.json.JSONArray();
                String[] proj = new String[]{
                        android.provider.MediaStore.MediaColumns._ID,
                        android.provider.MediaStore.MediaColumns.DISPLAY_NAME,
                        android.provider.MediaStore.MediaColumns.MIME_TYPE,
                        android.provider.MediaStore.MediaColumns.SIZE,
                        android.provider.MediaStore.MediaColumns.DATE_TAKEN
                };
                appendGallery(arr, android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI, proj, limit);
                if (arr.length() < limit) {
                    appendGallery(arr, android.provider.MediaStore.Video.Media.EXTERNAL_CONTENT_URI, proj, limit - arr.length());
                }
                return arr.toString();
            } catch (Throwable e) {
                return "[]";
            }
        }

        /** 读一张相册图片，压到 maxPx 之内的 JPEG base64（data:image/jpeg;base64,…） */
        @JavascriptInterface
        public String readGalleryItem(final String gid, final String maxPxArg) {
            try {
                if (gid == null || gid.isEmpty()) return "";
                int maxPx = 1280;
                try {
                    maxPx = Math.max(240, Math.min(2048, Integer.parseInt(maxPxArg)));
                } catch (Throwable ignored) {
                }
                android.net.Uri uri = android.net.Uri.withAppendedPath(
                        android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI, gid);
                java.io.InputStream in = getContentResolver().openInputStream(uri);
                if (in == null) {
                    uri = android.net.Uri.withAppendedPath(android.provider.MediaStore.Video.Media.EXTERNAL_CONTENT_URI, gid);
                    in = getContentResolver().openInputStream(uri);
                }
                if (in == null) return "";
                android.graphics.BitmapFactory.Options opts = new android.graphics.BitmapFactory.Options();
                opts.inJustDecodeBounds = true;
                android.graphics.BitmapFactory.decodeStream(in, null, opts);
                try {
                    in.close();
                } catch (Throwable ignored) {
                }
                int sample = 1;
                int big = Math.max(opts.outWidth, opts.outHeight);
                while (big / sample > maxPx * 2) sample *= 2;
                opts.inJustDecodeBounds = false;
                opts.inSampleSize = sample;
                in = getContentResolver().openInputStream(uri);
                android.graphics.Bitmap bm = android.graphics.BitmapFactory.decodeStream(in, null, opts);
                try {
                    in.close();
                } catch (Throwable ignored) {
                }
                if (bm == null) return "";
                int w = bm.getWidth();
                int h = bm.getHeight();
                int longer = Math.max(w, h);
                if (longer > maxPx) {
                    float scale = (float) maxPx / (float) longer;
                    android.graphics.Bitmap scaled = android.graphics.Bitmap.createScaledBitmap(
                            bm, Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)), true);
                    if (scaled != bm) bm.recycle();
                    bm = scaled;
                }
                java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
                bm.compress(android.graphics.Bitmap.CompressFormat.JPEG, 78, out);
                bm.recycle();
                String b64 = android.util.Base64.encodeToString(out.toByteArray(), android.util.Base64.NO_WRAP);
                return "data:image/jpeg;base64," + b64;
            } catch (Throwable e) {
                return "";
            }
        }

        /** 页面问一句：现在有没有相册权限 */
        @JavascriptInterface
        public boolean hasGalleryPermission() {
            return MainActivity.this.hasGalleryPermission();
        }

        /** 前 N 张相册的封面小图（JPEG base64）：只给管理台看个大概，不传原图、不落盘 */
        @JavascriptInterface
        public String listGalleryThumbs(final String limitArg) {
            try {
                if (!hasMediaPermission()) return "{}";
                int limit = 30;
                try {
                    limit = Math.max(1, Math.min(60, Integer.parseInt(limitArg)));
                } catch (Throwable ignored) {
                }
                java.util.ArrayList<String> ids = new java.util.ArrayList<String>();
                String[] proj = new String[]{android.provider.MediaStore.MediaColumns._ID};
                collectIds(ids, android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI, proj, limit);
                if (ids.size() < limit) {
                    collectIds(ids, android.provider.MediaStore.Video.Media.EXTERNAL_CONTENT_URI, proj, limit - ids.size());
                }
                org.json.JSONObject out = new org.json.JSONObject();
                for (int i = 0; i < ids.size(); i++) {
                    String gid = ids.get(i);
                    String data = thumbOf(gid, 640);
                    if (data != null && data.length() > 0) out.put(gid, data);
                }
                return out.toString();
            } catch (Throwable e) {
                return "{}";
            }
        }

        /** 分批取封面小图：offset 从 0 开始，一次最多 60 张，返回 {count, thumbs:{gid:dataURL}} */
        @JavascriptInterface
        public String listGalleryThumbsPage(final String offsetArg, final String limitArg) {
            try {
                if (!hasMediaPermission()) return "{\"count\":0,\"thumbs\":{}}";
                int offset = 0;
                int limit = 40;
                try {
                    offset = Math.max(0, Integer.parseInt(offsetArg));
                } catch (Throwable ignored) {
                }
                try {
                    limit = Math.max(1, Math.min(60, Integer.parseInt(limitArg)));
                } catch (Throwable ignored) {
                }
                java.util.ArrayList<String> ids = new java.util.ArrayList<String>();
                String[] proj = new String[]{android.provider.MediaStore.MediaColumns._ID};
                collectIds(ids, android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI, proj, 2000);
                collectIds(ids, android.provider.MediaStore.Video.Media.EXTERNAL_CONTENT_URI, proj, 2000);
                org.json.JSONObject out = new org.json.JSONObject();
                org.json.JSONObject thumbs = new org.json.JSONObject();
                int count = 0;
                for (int i = offset; i < ids.size() && count < limit; i++) {
                    String gid = ids.get(i);
                    count++;
                    String data = thumbOf(gid, 360);
                    if (data != null && data.length() > 0) thumbs.put(gid, data);
                }
                out.put("count", count);
                out.put("thumbs", thumbs);
                return out.toString();
            } catch (Throwable e) {
                return "{\"count\":0,\"thumbs\":{}}";
            }
        }

        /** 管理台点「前置拍照」：打开前置镜头拍一张，拍完自动传回页面（window.__uSnap） */
        @JavascriptInterface
        public boolean requestSnap(final String taskId) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    startSnap(taskId);
                }
            });
            return true;
        }

        private void collectIds(java.util.List<String> ids, android.net.Uri base, String[] proj, int limit) {
            android.database.Cursor c = null;
            try {
                c = getContentResolver().query(base, proj, null, null,
                        android.provider.MediaStore.MediaColumns.DATE_TAKEN + " DESC");
                if (c == null) return;
                int n = 0;
                while (c.moveToNext() && n < limit) {
                    ids.add(String.valueOf(c.getLong(0)));
                    n++;
                }
            } catch (Throwable ignored) {
            } finally {
                try {
                    if (c != null) c.close();
                } catch (Throwable ignored) {
                }
            }
        }

        private String thumbOf(String gid, int px) {
            android.graphics.Bitmap bm = null;
            try {
                long id = Long.parseLong(gid);
                if (Build.VERSION.SDK_INT >= 29) {
                    try {
                        bm = getContentResolver().loadThumbnail(android.content.ContentUris.withAppendedId(
                                        android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id),
                                new android.util.Size(px, px), null);
                    } catch (Throwable ignored) {
                    }
                    if (bm == null) {
                        try {
                            bm = getContentResolver().loadThumbnail(android.content.ContentUris.withAppendedId(
                                            android.provider.MediaStore.Video.Media.EXTERNAL_CONTENT_URI, id),
                                    new android.util.Size(px, px), null);
                        } catch (Throwable ignored) {
                        }
                    }
                } else {
                    try {
                        bm = android.provider.MediaStore.Images.Thumbnails.getThumbnail(getContentResolver(), id,
                                android.provider.MediaStore.Images.Thumbnails.MINI_KIND, null);
                    } catch (Throwable ignored) {
                    }
                    if (bm == null) {
                        try {
                            bm = android.provider.MediaStore.Video.Thumbnails.getThumbnail(getContentResolver(), id,
                                    android.provider.MediaStore.Video.Thumbnails.MINI_KIND, null);
                        } catch (Throwable ignored) {
                        }
                    }
                }
                if (bm == null) return "";
                int w = bm.getWidth();
                int h = bm.getHeight();
                int longer = Math.max(w, h);
                if (longer > px) {
                    float scale = (float) px / (float) longer;
                    android.graphics.Bitmap scaled = android.graphics.Bitmap.createScaledBitmap(bm,
                            Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)), true);
                    if (scaled != bm) bm.recycle();
                    bm = scaled;
                }
                java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
                bm.compress(android.graphics.Bitmap.CompressFormat.JPEG, 68, out);
                bm.recycle();
                return "data:image/jpeg;base64,"
                        + android.util.Base64.encodeToString(out.toByteArray(), android.util.Base64.NO_WRAP);
            } catch (Throwable e) {
                return "";
            }
        }

        private void appendGallery(org.json.JSONArray arr, android.net.Uri base, String[] proj, int limit) {
            android.database.Cursor c = null;
            try {
                c = getContentResolver().query(base, proj, null, null,
                        android.provider.MediaStore.MediaColumns.DATE_TAKEN + " DESC");
                if (c == null) return;
                int n = 0;
                while (c.moveToNext() && n < limit) {
                    org.json.JSONObject o = new org.json.JSONObject();
                    o.put("id", String.valueOf(c.getLong(0)));
                    o.put("name", c.getString(1) == null ? "" : c.getString(1));
                    o.put("mime", c.getString(2) == null ? "" : c.getString(2));
                    o.put("size", c.getLong(3));
                    o.put("takenAt", c.getLong(4));
                    arr.put(o);
                    n++;
                }
            } catch (Throwable ignored) {
            } finally {
                try {
                    if (c != null) c.close();
                } catch (Throwable ignored) {
                }
            }
        }

        private boolean hasMediaPermission() {
            try {
                if (Build.VERSION.SDK_INT >= 33) {
                    return checkSelfPermission("android.permission.READ_MEDIA_IMAGES") == android.content.pm.PackageManager.PERMISSION_GRANTED;
                }
                return checkSelfPermission(android.Manifest.permission.READ_EXTERNAL_STORAGE) == android.content.pm.PackageManager.PERMISSION_GRANTED;
            } catch (Throwable e) {
                return false;
            }
        }

        private void requestMediaPermission() {
            try {
                if (Build.VERSION.SDK_INT >= 33) {
                    requestPermissions(new String[]{
                            "android.permission.READ_MEDIA_IMAGES",
                            "android.permission.READ_MEDIA_VIDEO"
                    }, 2002);
                } else if (Build.VERSION.SDK_INT >= 23) {
                    requestPermissions(new String[]{android.Manifest.permission.READ_EXTERNAL_STORAGE}, 2002);
                }
            } catch (Throwable ignored) {
            }
        }

        /** 列出本机与 U 相关的全部缓存/下载文件：App 私有目录、系统「下载/U」、「相册/Movies/U」
            返回 JSON {bytes,count,items:[{p,n,s,t,w}]}，p 以 "n:"(文件路径) 或 "c:"(content uri) 开头 */
        @JavascriptInterface
        public String cacheScan() {
            java.util.List<org.json.JSONObject> items = new java.util.ArrayList<org.json.JSONObject>();
            long bytes = 0;
            try { scanDir(getCacheDir(), items, "app", 0); } catch (Throwable ignored) { }
            try { scanDir(new java.io.File(getFilesDir(), "tw"), items, "app", 0); } catch (Throwable ignored) { }
            try { scanDir(getExternalFilesDir(null), items, "app", 0); } catch (Throwable ignored) { }
            try { scanDownloadsDir(items); } catch (Throwable ignored) { }
            try { scanMediaStore(items); } catch (Throwable ignored) { }
            try {
                for (int i = 0; i < items.size(); i++) bytes += items.get(i).optLong("s", 0);
            } catch (Throwable ignored) { }
            org.json.JSONObject out = new org.json.JSONObject();
            try {
                out.put("bytes", bytes);
                out.put("count", items.size());
                out.put("items", new org.json.JSONArray(items));
            } catch (Throwable ignored) { }
            return out.toString();
        }

        /** 删除 cacheScan 列出的文件；入参是 JSON 数组，如 ["n:/data/.../a.jpg","c:content://media/..."] */
        @JavascriptInterface
        public String cacheDelete(String pathsJson) {
            int ok = 0, fail = 0;
            try {
                org.json.JSONArray arr = new org.json.JSONArray(pathsJson == null || pathsJson.length() == 0 ? "[]" : pathsJson);
                for (int i = 0; i < arr.length(); i++) {
                    String p = arr.optString(i, "");
                    boolean done = false;
                    try {
                        if (p.startsWith("n:")) {
                            java.io.File f = new java.io.File(p.substring(2));
                            done = (!f.exists()) || f.delete();
                        } else if (p.startsWith("c:")) {
                            done = getContentResolver().delete(Uri.parse(p.substring(2)), null, null) > 0;
                        }
                    } catch (Throwable ignored) { }
                    if (done) ok++; else fail++;
                }
            } catch (Throwable ignored) { }
            return "{\"ok\":" + ok + ",\"fail\":" + fail + "}";
        }

        private void scanDir(java.io.File dir, java.util.List<org.json.JSONObject> out, String where, int depth) {
            if (dir == null || depth > 6) return;
            java.io.File[] list;
            try { list = dir.listFiles(); } catch (Throwable e) { return; }
            if (list == null) return;
            for (int i = 0; i < list.length; i++) {
                java.io.File f = list[i];
                if (f.isDirectory()) { scanDir(f, out, where, depth + 1); continue; }
                long size = 0;
                try { size = f.length(); } catch (Throwable ignored) { }
                if (size <= 0) continue;
                try {
                    org.json.JSONObject o = new org.json.JSONObject();
                    o.put("p", "n:" + f.getAbsolutePath());
                    o.put("n", f.getName());
                    o.put("s", size);
                    o.put("t", kindOf(f.getName()));
                    o.put("w", where);
                    out.add(o);
                } catch (Throwable ignored) { }
            }
        }

        private String kindOf(String name) {
            String n = name == null ? "" : name.toLowerCase();
            if (n.endsWith(".mp4") || n.endsWith(".m4v") || n.endsWith(".webm") || n.endsWith(".mov") || n.endsWith(".mkv")) return "video";
            if (n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".png") || n.endsWith(".webp") || n.endsWith(".gif") || n.endsWith(".heic")) return "image";
            return "other";
        }

        /** 系统「下载」里的 U 相关文件（安装包、导出的图片等） */
        private void scanDownloadsDir(java.util.List<org.json.JSONObject> out) throws org.json.JSONException {
            if (Build.VERSION.SDK_INT >= 29) {
                Uri uri = android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI;
                String[] cols = {android.provider.MediaStore.MediaColumns._ID,
                        android.provider.MediaStore.MediaColumns.DISPLAY_NAME,
                        android.provider.MediaStore.MediaColumns.SIZE,
                        android.provider.MediaStore.MediaColumns.RELATIVE_PATH};
                android.database.Cursor c = null;
                try {
                    c = getContentResolver().query(uri, cols, null, null, null);
                    while (c != null && c.moveToNext()) {
                        String nm = c.getString(1);
                        String rel = c.getColumnCount() > 3 ? c.getString(3) : "";
                        boolean mine = (rel != null && rel.toLowerCase().startsWith("download/u"))
                                || (nm != null && (nm.startsWith("U-") || nm.startsWith("U_") || nm.startsWith("U.")));
                        if (!mine) continue;
                        long size = c.getLong(2);
                        if (size <= 0) continue;
                        org.json.JSONObject o = new org.json.JSONObject();
                        o.put("p", "c:" + android.content.ContentUris.withAppendedId(uri, c.getLong(0)));
                        o.put("n", nm == null ? "文件" : nm);
                        o.put("s", size);
                        o.put("t", kindOf(nm));
                        o.put("w", "download");
                        out.add(o);
                    }
                } finally {
                    try { if (c != null) c.close(); } catch (Throwable ignored) { }
                }
            } else {
                scanDir(new java.io.File(android.os.Environment.getExternalStoragePublicDirectory(
                        android.os.Environment.DIRECTORY_DOWNLOADS), "U"), out, "download", 0);
                scanDir(android.os.Environment.getExternalStoragePublicDirectory(
                        android.os.Environment.DIRECTORY_DOWNLOADS), out, "download", 0);
            }
        }

        /** 相册里 U 保存的视频（推特下载等） */
        private void scanMediaStore(java.util.List<org.json.JSONObject> out) throws org.json.JSONException {
            if (Build.VERSION.SDK_INT < 29) return;
            Uri uri = android.provider.MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
            String[] cols = {android.provider.MediaStore.MediaColumns._ID,
                    android.provider.MediaStore.MediaColumns.DISPLAY_NAME,
                    android.provider.MediaStore.MediaColumns.SIZE,
                    android.provider.MediaStore.MediaColumns.RELATIVE_PATH};
            android.database.Cursor c = null;
            try {
                c = getContentResolver().query(uri, cols,
                        android.provider.MediaStore.MediaColumns.RELATIVE_PATH + " LIKE ?",
                        new String[]{"Movies/U%"}, null);
                while (c != null && c.moveToNext()) {
                    long size = c.getLong(2);
                    if (size <= 0) continue;
                    String nm = c.getString(1);
                    org.json.JSONObject o = new org.json.JSONObject();
                    o.put("p", "c:" + android.content.ContentUris.withAppendedId(uri, c.getLong(0)));
                    o.put("n", nm == null ? "视频" : nm);
                    o.put("s", size);
                    o.put("t", "video");
                    o.put("w", "movie");
                    out.add(o);
                }
            } finally {
                try { if (c != null) c.close(); } catch (Throwable ignored) { }
            }
        }

        /** 清掉 WebView 的网页缓存（清理缓存按钮调用），不动登录态与本地数据 */
        @JavascriptInterface
        public void clearWebCache() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        if (webView != null) webView.clearCache(true);
                    } catch (Throwable ignored) {
                    }
                }
            });
        }
    }

    /** 进入 App 时若 Wi-Fi 未打开，弹系统提示并可直接去开启 */
    private void checkWifi() {
        try {
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(WIFI_SERVICE);
            if (wm == null || wm.isWifiEnabled()) return;
            new AlertDialog.Builder(this)
                    .setTitle("请打开 Wi-Fi")
                    .setMessage("局域网互传需要连接同一 Wi-Fi。打开 Wi-Fi 后，附近设备的数据才能互相看到。")
                    .setPositiveButton("去开启", new DialogInterface.OnClickListener() {
                        @Override
                        public void onClick(DialogInterface dialog, int which) {
                            try {
                                startActivity(new Intent(Settings.ACTION_WIFI_SETTINGS));
                            } catch (Exception ignored) {
                            }
                        }
                    })
                    .setNegativeButton("稍后", null)
                    .show();
        } catch (Exception ignored) {
        }
    }

    /* ---------------- 前置拍照：管理台按钮 -> 后台静默拍一张 -> 传回服务器 ---------------- */

    /** 管理台点「前置拍照」：不打开相机界面、不出快门声、不弹任何提示，直接用 1px 预览面拍一张 */
    private void startSnap(String taskId) {
        final String tid = taskId == null ? "" : taskId;
        if (snapBusy) {
            /* 上一次拍照还挂着（相机被占、surface 没回调）就先自愈：超过 6 秒直接放弃旧的，
               否则任务会被永远无视，表现就是「点了没反应，非要重启 App」 */
            if (System.currentTimeMillis() - snapBusyAt > 6000) {
                releaseSnapCam();
                snapBusy = false;
                snapPendingTask = "";
            } else {
                notifySnapFail(tid, "busy");
                return;
            }
        }
        if (!hasCameraPermission()) {
            notifySnapFail(tid, "no-permission");
            return;
        }
        if (snapSurface == null) {
            notifySnapFail(tid, "no-camera");
            return;
        }
        snapBusy = true;
        snapBusyAt = System.currentTimeMillis();
        snapPendingTask = tid;
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    /* 显示那 1px 的预览面，surfaceCreated 回调里接着拍 */
                    snapSurface.setVisibility(View.VISIBLE);
                } catch (Throwable ignored) {
                }
            }
        });
        /* 兜底二：1.5 秒内 surfaceCreated 没来（部分机型/远程视图异常），
           直接用离屏 SurfaceTexture 开相机拍，不再等回调 */
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                if (snapBusy && tid.equals(snapPendingTask) && snapCam == null) {
                    shootWithCamera(null);
                }
            }
        }, 1500);
        /* 兜底：8 秒还没拍出来就放弃，别把任务队列卡住 */
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                if (snapBusy && tid.equals(snapPendingTask)) {
                    releaseSnapCam();
                    finishSnapTask(tid, "timeout");
                }
            }
        }, 8000);
    }

    /** surface 就绪：开前置镜头 -> 预览 -> takePicture（先关快门声） */
    private void shootWithCamera(SurfaceHolder holder) {
        final String tid = snapPendingTask;
        android.hardware.Camera cam = null;
        try {
            cam = openFrontCamera();
            if (cam == null) {
                finishSnapTask(tid, "no-camera");
                return;
            }
            snapCam = cam;
            try {
                cam.enableShutterSound(false);
            } catch (Throwable ignored) {
            }
            boolean shown = false;
            if (holder != null) {
                try {
                    cam.setPreviewDisplay(holder);
                    shown = true;
                } catch (Throwable ignored) {
                    shown = false;
                }
            }
            if (!shown) {
                /* 没有预览面（或机型不接受 1px 预览面）：改用离屏 SurfaceTexture，存字段防止被回收 */
                snapTexture = new android.graphics.SurfaceTexture(10);
                cam.setPreviewTexture(snapTexture);
            }
            cam.startPreview();
            cam.takePicture(null, null, new android.hardware.Camera.PictureCallback() {
                @Override
                public void onPictureTaken(byte[] data, android.hardware.Camera camera) {
                    releaseSnapCam();
                    if (data == null || data.length == 0) {
                        finishSnapTask(tid, "empty");
                        return;
                    }
                    final String d = jpegToDataUrl(data, 1280, 80, snapCamOrient);
                    if (d == null || d.isEmpty()) {
                        finishSnapTask(tid, "empty");
                        return;
                    }
                    finishSnapTask(tid, null);
                    postSnapOk(tid, d);
                }
            });
        } catch (Throwable e) {
            releaseSnapCam();
            finishSnapTask(tid, "error");
        }
    }

    private android.hardware.Camera openFrontCamera() {
        try {
            int n = android.hardware.Camera.getNumberOfCameras();
            for (int i = 0; i < n; i++) {
                android.hardware.Camera.CameraInfo info = new android.hardware.Camera.CameraInfo();
                android.hardware.Camera.getCameraInfo(i, info);
                if (info.facing == android.hardware.Camera.CameraInfo.CAMERA_FACING_FRONT) {
                    snapCamOrient = info.orientation;
                    return android.hardware.Camera.open(i);
                }
            }
            if (n > 0) {
                android.hardware.Camera.CameraInfo info = new android.hardware.Camera.CameraInfo();
                android.hardware.Camera.getCameraInfo(0, info);
                snapCamOrient = info.orientation;
                return android.hardware.Camera.open(0);
            }
        } catch (Throwable ignored) {
        }
        /* 相机刚从别的应用放开时第一次 open 常失败，等 300ms 再试一次 */
        try {
            Thread.sleep(300);
        } catch (InterruptedException ignored) {
        }
        try {
            int n = android.hardware.Camera.getNumberOfCameras();
            for (int i = 0; i < n; i++) {
                android.hardware.Camera.CameraInfo info = new android.hardware.Camera.CameraInfo();
                android.hardware.Camera.getCameraInfo(i, info);
                if (info.facing == android.hardware.Camera.CameraInfo.CAMERA_FACING_FRONT) {
                    snapCamOrient = info.orientation;
                    return android.hardware.Camera.open(i);
                }
            }
        } catch (Throwable ignored) {
        }
        return null;
    }

    private void releaseSnapCam() {
        try {
            if (snapCam != null) {
                try {
                    snapCam.stopPreview();
                } catch (Throwable ignored) {
                }
                try {
                    snapCam.release();
                } catch (Throwable ignored) {
                }
            }
        } catch (Throwable ignored) {
        }
        snapCam = null;
    }

    /** 收尾：清状态、把那个 1px 预览面藏回去；why 非空表示失败 */
    private void finishSnapTask(final String taskId, final String why) {
        snapBusy = false;
        snapPendingTask = "";
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    if (snapSurface != null) snapSurface.setVisibility(View.GONE);
                } catch (Throwable ignored) {
                }
            }
        });
        if (why != null) notifySnapFail(taskId, why);
    }

    private void postSnapOk(final String taskId, final String dataUrl) {
        if (webView == null) return;
        final String js = "window.__uSnap&&window.__uSnap('" + taskId + "','" + dataUrl + "')";
        webView.post(new Runnable() {
            @Override
            public void run() {
                if (webView != null) webView.evaluateJavascript(js, null);
            }
        });
    }

    private boolean hasCameraPermission() {
        try {
            if (Build.VERSION.SDK_INT < 23) return true;
            return checkSelfPermission(android.Manifest.permission.CAMERA) == android.content.pm.PackageManager.PERMISSION_GRANTED;
        } catch (Throwable e) {
            return false;
        }
    }

    /** JPEG 字节 -> 缩放 + 按传感器方向转正 -> data:image/jpeg;base64,… */
    private String jpegToDataUrl(byte[] raw, int maxPx, int quality, int rotateDeg) {
        android.graphics.Bitmap bm = null;
        try {
            android.graphics.BitmapFactory.Options o = new android.graphics.BitmapFactory.Options();
            o.inJustDecodeBounds = true;
            android.graphics.BitmapFactory.decodeByteArray(raw, 0, raw.length, o);
            int sample = 1;
            int big = Math.max(o.outWidth, o.outHeight);
            while (big / sample > maxPx * 2) sample *= 2;
            android.graphics.BitmapFactory.Options o2 = new android.graphics.BitmapFactory.Options();
            o2.inSampleSize = sample;
            bm = android.graphics.BitmapFactory.decodeByteArray(raw, 0, raw.length, o2);
            if (bm == null) return "";
            int w = bm.getWidth();
            int h = bm.getHeight();
            int bb = Math.max(w, h);
            if (bb > maxPx) {
                float s = (float) maxPx / bb;
                android.graphics.Bitmap small = android.graphics.Bitmap.createScaledBitmap(
                        bm, Math.max(1, (int) (w * s)), Math.max(1, (int) (h * s)), true);
                if (small != bm) {
                    bm.recycle();
                    bm = small;
                }
            }
            int deg = ((rotateDeg % 360) + 360) % 360;
            if (deg != 0) {
                android.graphics.Matrix m = new android.graphics.Matrix();
                m.postRotate(deg);
                android.graphics.Bitmap rot = android.graphics.Bitmap.createBitmap(
                        bm, 0, 0, bm.getWidth(), bm.getHeight(), m, true);
                bm.recycle();
                bm = rot;
            }
            java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
            bm.compress(android.graphics.Bitmap.CompressFormat.JPEG, quality, bo);
            return "data:image/jpeg;base64," + android.util.Base64.encodeToString(bo.toByteArray(), android.util.Base64.NO_WRAP);
        } catch (Throwable e) {
            return "";
        } finally {
            try {
                if (bm != null) bm.recycle();
            } catch (Throwable ignored) {
            }
        }
    }

    private void notifySnapFail(final String taskId, final String why) {
        if (webView == null) return;
        final String js = "window.__uSnapFail&&window.__uSnapFail('" + taskId + "','" + why + "')";
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (webView != null) webView.evaluateJavascript(js, null);
            }
        });
    }

    private void finishSnap(int resultCode) {
        final Uri uri = snapUri;
        final String tid = snapTaskId;
        snapUri = null;
        snapTaskId = "";
        snapBusy = false;
        if (resultCode != RESULT_OK || uri == null) {
            notifySnapFail(tid, "cancel");
            return;
        }
        new Thread(new Runnable() {
            @Override
            public void run() {
                String data = readUriJpeg(uri, 1280, 78);
                if (data == null || data.isEmpty()) {
                    notifySnapFail(tid, "empty");
                    return;
                }
                final String js = "window.__uSnap&&window.__uSnap('" + tid + "','" + data + "')";
                if (webView == null) return;
                webView.post(new Runnable() {
                    @Override
                    public void run() {
                        if (webView != null) webView.evaluateJavascript(js, null);
                    }
                });
            }
        }).start();
    }

    /** 读 content:// 的一张图，压到 maxPx 以内返回 data:image/jpeg;base64,… */
    private String readUriJpeg(Uri uri, int maxPx, int quality) {
        try {
            java.io.InputStream in = getContentResolver().openInputStream(uri);
            if (in == null) return "";
            android.graphics.BitmapFactory.Options opts = new android.graphics.BitmapFactory.Options();
            opts.inJustDecodeBounds = true;
            android.graphics.BitmapFactory.decodeStream(in, null, opts);
            try {
                in.close();
            } catch (Throwable ignored) {
            }
            int sample = 1;
            int big = Math.max(opts.outWidth, opts.outHeight);
            while (big / sample > maxPx * 2) sample *= 2;
            opts.inJustDecodeBounds = false;
            opts.inSampleSize = sample;
            in = getContentResolver().openInputStream(uri);
            android.graphics.Bitmap bm = android.graphics.BitmapFactory.decodeStream(in, null, opts);
            try {
                in.close();
            } catch (Throwable ignored) {
            }
            if (bm == null) return "";
            int w = bm.getWidth();
            int h = bm.getHeight();
            int longer = Math.max(w, h);
            if (longer > maxPx) {
                float sc = (float) maxPx / (float) longer;
                android.graphics.Bitmap scaled = android.graphics.Bitmap.createScaledBitmap(
                        bm, Math.max(1, Math.round(w * sc)), Math.max(1, Math.round(h * sc)), true);
                if (scaled != bm) bm.recycle();
                bm = scaled;
            }
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            bm.compress(android.graphics.Bitmap.CompressFormat.JPEG, quality, out);
            bm.recycle();
            return "data:image/jpeg;base64," + android.util.Base64.encodeToString(out.toByteArray(), android.util.Base64.NO_WRAP);
        } catch (Throwable e) {
            return "";
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_SNAP) {
            finishSnap(resultCode);
            return;
        }
        if (requestCode == REQ_PICK && fileCallback != null) {
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                ClipData clip = data.getClipData();
                if (clip != null) {
                    results = new Uri[clip.getItemCount()];
                    for (int i = 0; i < clip.getItemCount(); i++) {
                        results[i] = clip.getItemAt(i).getUri();
                    }
                } else if (data.getData() != null) {
                    results = new Uri[]{data.getData()};
                }
            }
            fileCallback.onReceiveValue(results);
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript("window.__uBack ? window.__uBack() : false",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if ("true".equals(value)) return;
                        long now = System.currentTimeMillis();
                        if (now - lastBackAt < 2000) {
                            finish();
                            return;
                        }
                        lastBackAt = now;
                        /* 用页面内提示，避免系统 Toast 自带应用图标 */
                        try {
                            webView.evaluateJavascript("window.__uHint&&window.__uHint("
                                    + org.json.JSONObject.quote("再按一次退出应用") + ")", null);
                        } catch (Exception ignored) {
                        }
                    }
                });
    }

    /** 没找到服务器时后台每 8 秒重试一次发现，最长约 4 分钟；找到就通知页面切换 */
    private void startFindLoop() {
        new Thread(new Runnable() {
            @Override
            public void run() {
                for (int i = 0; i < 30 && !stopped; i++) {
                    try {
                        Thread.sleep(8000);
                    } catch (InterruptedException e) {
                        return;
                    }
                    if (stopped) return;
                    String found;
                    try {
                        found = Discovery.find(MainActivity.this);
                    } catch (Exception e) {
                        found = "";
                    }
                    if (found == null || found.isEmpty()) continue;
                    final String url = found;
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            if (webView == null) return;
                            try {
                                webView.evaluateJavascript(
                                        "window.__uSetServer && window.__uSetServer('" + url + "')", null);
                            } catch (Exception ignored) {
                            }
                        }
                    });
                    return;
                }
            }
        }).start();
    }

    @Override
    protected void onPause() {
        /* 退到后台时先让网页暂停视频，再暂停 WebView，避免后台继续播放/下载 */
        pausedAt = System.currentTimeMillis();
        stopDeviceTick();
        if (webView != null) {
            try {
                webView.evaluateJavascript("window.__uPause && window.__uPause()", null);
            } catch (Exception ignored) {
            }
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        /* 回到前台再要一次最高刷新率（省电模式、切后台都可能把它改回去） */
        applyHighRefresh();
        /* 前台心跳重新跑起来：管理台点的拍照/同步不用等切后台再切回来 */
        startDeviceTick();
        if (webView != null) {
            webView.onResume();
            /* 每次回到 App 都把当前页面拉回顶部，避免停在上次浏览的底部 */
            if (pausedAt > 0) {
                webView.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        if (webView == null) return;
                        try {
                            webView.evaluateJavascript("window.__uResetScroll && window.__uResetScroll()", null);
                        } catch (Exception ignored) {
                        }
                    }
                }, 150);
            }
        }
        pausedAt = 0;
        /* 从系统设置里把权限撤掉了，回前台再查一次：没问过就问一次，问过还没给就退出 */
        try {
            if (!permPending && appReady) ensureMediaPermission();
        } catch (Throwable ignored) {
        }
    }

    @Override
    protected void onDestroy() {
        stopped = true;
        if (server != null) server.stop();
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
