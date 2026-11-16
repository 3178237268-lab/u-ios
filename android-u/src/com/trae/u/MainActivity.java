package com.trae.u;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.net.Uri;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
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

    private WebView webView;
    private LocalServer server;
    private ValueCallback<Uri[]> fileCallback;
    private long pausedAt = 0;
    /** 手势返回：两次以内才真正退出 App */
    private long lastBackAt = 0;
    /** 页面销毁后停掉后台重试线程 */
    private volatile boolean stopped = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        enableEdgeToEdge();
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

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
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);

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

        final TextView hint = new TextView(this);
        hint.setText("正在查找服务器…");
        hint.setTextColor(Color.WHITE);
        hint.setTextSize(15f);
        FrameLayout.LayoutParams hlp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT);
        hlp.gravity = Gravity.CENTER;
        root.addView(hint, hlp);

        setContentView(root);
        webView.addJavascriptInterface(new HostBridge(), "UHost");

        webView.setVisibility(View.INVISIBLE);
        new Thread(new Runnable() {
            @Override
            public void run() {
                String base = "";
                try {
                    base = Discovery.find(MainActivity.this);
                } catch (Exception e) {
                    base = "";
                }
                final String srv = base == null ? "" : base;
                final String local = "http://127.0.0.1:" + server.getPort() + "/index.html";
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        String url = local;
                        if (!srv.isEmpty()) {
                            try {
                                url = local + "?srv=" + java.net.URLEncoder.encode(srv, "UTF-8");
                            } catch (Exception e) {
                                url = local + "?srv=" + srv;
                            }
                        }
                        hint.setVisibility(View.GONE);
                        webView.setVisibility(View.VISIBLE);
                        webView.loadUrl(url);
                        /* 没找到服务器就一直后台重试：用户过一会儿才开服务器也能自动连上 */
                        if (srv.isEmpty()) startFindLoop();
                    }
                });
            }
        }).start();

        checkWifi();
    }

    /** 状态栏/导航栏透明并延伸到屏幕边缘，消除上下黑边 */
    private void enableEdgeToEdge() {
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            w.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            w.setStatusBarColor(Color.TRANSPARENT);
            w.setNavigationBarColor(Color.TRANSPARENT);
        }
        // MIUI 14 底部小白条会出现白色对比边，关闭系统对比度补偿
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                w.setNavigationBarContrastEnforced(false);
                w.setStatusBarContrastEnforced(false);
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

    /** 浅色主题时让系统栏图标变深色，深色主题时恢复浅色 */
    private void applyBarStyle(final boolean dark) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
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
            return Discovery.cached();
        }

        /** 前端点「重新搜索」时调用：重跑一遍发现并返回地址（阻塞，最长约 6 秒） */
        @JavascriptInterface
        public String rescanServer() {
            String found = Discovery.find(MainActivity.this);
            if (found != null && !found.isEmpty()) Discovery.save(MainActivity.this, found);
            return found == null ? "" : found;
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

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
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
                        Toast.makeText(MainActivity.this, "再按一次退出应用", Toast.LENGTH_SHORT).show();
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
