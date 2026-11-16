package com.trae.u;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.Socket;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/**
 * 局域网服务器发现。
 *
 * 顺序：
 * 1) 上次用过的地址（SharedPreferences），先探活，通了直接用 —— 秒开；
 * 2) UDP 广播到 8788 端口，服务器回一段 JSON，从报文来源 IP 拿到地址 —— 一次往返；
 * 3) 兜底：扫描本机所在 /24 网段的所有 8787 端口，用 /api/discover 确认身份。
 */
public final class Discovery {

    private static final String TAG = "UDiscovery";
    private static final String PREF = "u_server";
    private static final String KEY = "srv";

    /** 服务器 UDP 发现端口，与 server/src/server.js 的 U_DISCOVER_PORT 保持一致 */
    public static final int UDP_PORT = 8788;
    /** 默认 HTTP 端口 */
    public static final int HTTP_PORT = 8787;

    private static volatile String cached = "";

    private Discovery() {
    }

    /** 当前已确定的地址（可能为空） */
    public static String cached() {
        return cached == null ? "" : cached;
    }

    public static String saved(Context ctx) {
        try {
            SharedPreferences sp = ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE);
            String v = sp.getString(KEY, "");
            return v == null ? "" : v.trim();
        } catch (Exception e) {
            return "";
        }
    }

    public static void save(Context ctx, String url) {
        if (url == null || url.isEmpty()) return;
        cached = url;
        try {
            ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE).edit().putString(KEY, url).apply();
        } catch (Exception ignored) {
        }
    }

    /** 简单探活：/api/health 返回 ok:true 且 app=U */
    public static boolean alive(String base) {
        if (base == null || base.isEmpty()) return false;
        String root = base.replaceAll("/+$", "");
        java.net.HttpURLConnection c = null;
        try {
            URL u = new URL(root + "/api/health");
            c = (java.net.HttpURLConnection) u.openConnection();
            c.setConnectTimeout(900);
            c.setReadTimeout(1200);
            c.setRequestMethod("GET");
            c.setUseCaches(false);
            int code = c.getResponseCode();
            if (code != 200) return false;
            BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
            r.close();
            String body = sb.toString();
            return body.contains("\"ok\"") && body.indexOf("true") > 0;
        } catch (Exception e) {
            return false;
        } finally {
            if (c != null) {
                try {
                    c.disconnect();
                } catch (Exception ignored) {
                }
            }
        }
    }

    /** 阻塞式查找，最长约 6 秒。返回形如 http://192.168.1.5:8787 ，找不到返回空串 */
    public static String find(Context ctx) {
        String saved = saved(ctx);
        if (!saved.isEmpty() && alive(saved)) {
            cached = saved;
            return saved;
        }
        String udp = udpProbe();
        if (udp != null && !udp.isEmpty() && alive(udp)) {
            save(ctx, udp);
            return udp;
        }
        String scan = scanSubnets();
        if (scan != null && !scan.isEmpty()) {
            save(ctx, scan);
            return scan;
        }
        /* 都没找到：不要把已经死掉的旧地址再返回给页面，交给前端提示/重试 */
        cached = "";
        return "";
    }

    /* ---------------- UDP 广播探测 ---------------- */

    private static String udpProbe() {
        DatagramSocket sock = null;
        try {
            sock = new DatagramSocket();
            sock.setBroadcast(true);
            sock.setSoTimeout(400);
            byte[] payload = "U-DISCOVER-V1".getBytes("UTF-8");
            List<InetAddress> targets = broadcastTargets();
            for (InetAddress addr : targets) {
                try {
                    sock.send(new DatagramPacket(payload, payload.length, addr, UDP_PORT));
                } catch (Exception ignored) {
                }
            }
            long deadline = System.currentTimeMillis() + 1600;
            byte[] buf = new byte[2048];
            while (System.currentTimeMillis() < deadline) {
                DatagramPacket p = new DatagramPacket(buf, buf.length);
                try {
                    sock.receive(p);
                } catch (java.net.SocketTimeoutException te) {
                    continue;
                } catch (Exception e) {
                    break;
                }
                String body = new String(p.getData(), 0, p.getLength(), "UTF-8");
                int port = HTTP_PORT;
                try {
                    JSONObject o = new JSONObject(body);
                    if (o.has("app") && !"U".equals(o.optString("app"))) continue;
                    port = o.optInt("port", HTTP_PORT);
                } catch (Exception ignored) {
                    if (!body.contains("U")) continue;
                }
                String ip = p.getAddress() == null ? "" : p.getAddress().getHostAddress();
                if (ip.isEmpty() || "0.0.0.0".equals(ip)) continue;
                String url = "http://" + ip + ":" + port;
                Log.i(TAG, "UDP 发现服务器 " + url);
                return url;
            }
        } catch (Exception e) {
            Log.w(TAG, "UDP 探测失败: " + e.getMessage());
        } finally {
            if (sock != null) {
                try {
                    sock.close();
                } catch (Exception ignored) {
                }
            }
        }
        return "";
    }

    /** 广播地址：255.255.255.255 + 每个网卡的接口广播地址 */
    private static List<InetAddress> broadcastTargets() {
        List<InetAddress> list = new ArrayList<>();
        try {
            list.add(InetAddress.getByName("255.255.255.255"));
        } catch (Exception ignored) {
        }
        try {
            Enumeration<NetworkInterface> nis = NetworkInterface.getNetworkInterfaces();
            while (nis.hasMoreElements()) {
                NetworkInterface ni = nis.nextElement();
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InterfaceAddress ia : ni.getInterfaceAddresses()) {
                    InetAddress b = ia.getBroadcast();
                    if (b != null && !list.contains(b)) list.add(b);
                }
            }
        } catch (Exception ignored) {
        }
        return list;
    }

    /* ---------------- 网段扫描兜底 ---------------- */

    private static String scanSubnets() {
        List<String> prefixes = localPrefixes();
        for (String prefix : prefixes) {
            String hit = scanPrefix(prefix);
            if (hit != null && !hit.isEmpty()) return hit;
        }
        return "";
    }

    /** 本机可用的 /24 前缀，如 192.168.1 */
    private static List<String> localPrefixes() {
        List<String> out = new ArrayList<>();
        try {
            Enumeration<NetworkInterface> nis = NetworkInterface.getNetworkInterfaces();
            while (nis.hasMoreElements()) {
                NetworkInterface ni = nis.nextElement();
                if (!ni.isUp() || ni.isLoopback()) continue;
                Enumeration<InetAddress> addrs = ni.getInetAddresses();
                while (addrs.hasMoreElements()) {
                    InetAddress a = addrs.nextElement();
                    if (!(a instanceof Inet4Address) || a.isLoopbackAddress()) continue;
                    String ip = a.getHostAddress();
                    String[] p = ip.split("\\.");
                    if (p.length != 4) continue;
                    String prefix = p[0] + "." + p[1] + "." + p[2];
                    if (prefix.startsWith("0.") || prefix.startsWith("127.")) continue;
                    if (!out.contains(prefix)) out.add(prefix);
                }
            }
        } catch (Exception ignored) {
        }
        return out;
    }

    private static String scanPrefix(final String prefix) {
        ExecutorService pool = Executors.newFixedThreadPool(48);
        List<Future<String>> futures = new ArrayList<>();
        try {
            for (int i = 1; i <= 254; i++) {
                final String ip = prefix + "." + i;
                futures.add(pool.submit(new Callable<String>() {
                    @Override
                    public String call() {
                        if (tcpOpen(ip, HTTP_PORT)) {
                            String url = "http://" + ip + ":" + HTTP_PORT;
                            if (alive(url)) return url;
                        }
                        return "";
                    }
                }));
            }
            for (Future<String> f : futures) {
                try {
                    String v = f.get();
                    if (v != null && !v.isEmpty()) {
                        Log.i(TAG, "扫描发现服务器 " + v);
                        return v;
                    }
                } catch (Exception ignored) {
                }
            }
        } finally {
            pool.shutdownNow();
        }
        return "";
    }

    private static boolean tcpOpen(String ip, int port) {
        Socket s = new Socket();
        try {
            s.connect(new InetSocketAddress(ip, port), 320);
            return true;
        } catch (Exception e) {
            return false;
        } finally {
            try {
                s.close();
            } catch (Exception ignored) {
            }
        }
    }
}
