package com.trae.u;

import android.content.Context;
import android.content.res.AssetManager;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.util.Log;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 本地 HTTP 服务：
 * 1) 127.0.0.1:port 暴露 assets/www 给 WebView（同时提供 /lan/* 自身读写接口）
 * 2) 0.0.0.0:lanPort 暴露 /lan/* 给同一 Wi-Fi 下的其他手机
 * 3) UDP 17879 广播用于自动发现设备
 *
 * 局域网共享数据统一存放在应用私有目录 files/lan/ 下：
 *   files/lan/snapshot.json  帖子/备忘录/通知快照
 *   files/lan/media/<id>     图片与视频
 */
public class LocalServer {

    private static final String TAG = "ULan";
    private static final int[] PORT_CANDIDATES = {17871, 17872, 17873, 17874};
    private static final int[] LAN_PORT_CANDIDATES = {17880, 17881, 17882, 17883, 17884};
    private static final int DISCOVERY_PORT = 17879;
    private static final long PEER_TTL = 20000L;

    private final AssetManager assets;
    private final Context ctx;
    private final File lanDir;
    private final File mediaDir;
    private final File clientsDir;
    private final String deviceId;
    private final String deviceName;

    private ServerSocket serverSocket;
    private ServerSocket lanSocket;
    private DatagramSocket udp;
    private ExecutorService pool;
    private volatile boolean running;
    private int port;
    private int lanPort;

    private WifiManager.MulticastLock multicastLock;
    private Thread discoveryThread;

    private final Map<String, Peer> peers = new ConcurrentHashMap<String, Peer>();

    /* 静态资源内存缓存：APK 里的 assets 每次读都要解压一遍（首页 + vendor 约 3 MB），
       第二次启动直接从内存拿，手机上的首屏会快很多 */
    private final Map<String, byte[]> assetCache = new ConcurrentHashMap<String, byte[]>();
    private static final int ASSET_CACHE_BYTES = 6 * 1024 * 1024;
    private volatile int assetCacheUsed = 0;

    private static class Peer {
        final String ip;
        final int port;
        final String id;
        final long seen;

        Peer(String ip, int port, String id, long seen) {
            this.ip = ip;
            this.port = port;
            this.id = id;
            this.seen = seen;
        }
    }

    public LocalServer(Context ctx, AssetManager assets) {
        this.ctx = ctx.getApplicationContext();
        this.assets = assets;
        File base = null;
        try {
            base = this.ctx.getExternalFilesDir(null);
        } catch (Exception ignored) {
        }
        if (base == null) base = this.ctx.getFilesDir();
        this.lanDir = new File(base, "lan");
        this.mediaDir = new File(lanDir, "media");
        this.clientsDir = new File(lanDir, "clients");
        if (!lanDir.exists()) lanDir.mkdirs();
        if (!mediaDir.exists()) mediaDir.mkdirs();
        if (!clientsDir.exists()) clientsDir.mkdirs();
        this.deviceId = loadDeviceId();
        this.deviceName = (Build.MODEL == null || Build.MODEL.isEmpty()) ? "Android" : Build.MODEL;
    }

    private String loadDeviceId() {
        File f = new File(lanDir, "device.id");
        try {
            if (f.exists()) {
                byte[] b = readFile(f);
                String s = new String(b, StandardCharsets.UTF_8).trim();
                if (!s.isEmpty()) return s;
            }
            String id = "dev_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
            FileOutputStream out = new FileOutputStream(f);
            out.write(id.getBytes(StandardCharsets.UTF_8));
            out.close();
            return id;
        } catch (IOException e) {
            return "dev_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        }
    }

    /** 固定端口：WebView 的 IndexedDB 按 origin 隔离，端口变化会导致数据“消失” */
    public int start() throws IOException {
        for (int candidate : PORT_CANDIDATES) {
            try {
                serverSocket = new ServerSocket(candidate, 50, InetAddress.getByName("127.0.0.1"));
                port = candidate;
                break;
            } catch (IOException ignored) {
                // 端口被占用，尝试下一个
            }
        }
        if (serverSocket == null) {
            serverSocket = new ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"));
            port = serverSocket.getLocalPort();
        }

        for (int candidate : LAN_PORT_CANDIDATES) {
            try {
                lanSocket = new ServerSocket(candidate, 50, InetAddress.getByName("0.0.0.0"));
                lanPort = candidate;
                break;
            } catch (IOException ignored) {
            }
        }
        if (lanSocket == null) {
            try {
                lanSocket = new ServerSocket(0, 50, InetAddress.getByName("0.0.0.0"));
                lanPort = lanSocket.getLocalPort();
            } catch (IOException e) {
                Log.w(TAG, "lan socket failed: " + e.getMessage());
            }
        }

        running = true;
        pool = Executors.newFixedThreadPool(8);

        Thread local = new Thread(new Runnable() {
            @Override
            public void run() {
                acceptLoop(serverSocket);
            }
        }, "u-http");
        local.setDaemon(true);
        local.start();

        if (lanSocket != null) {
            Thread lan = new Thread(new Runnable() {
                @Override
                public void run() {
                    acceptLoop(lanSocket);
                }
            }, "u-lan-http");
            lan.setDaemon(true);
            lan.start();
            startDiscovery();
        }
        return port;
    }

    private void acceptLoop(final ServerSocket ss) {
        while (running) {
            try {
                final Socket socket = ss.accept();
                pool.execute(new Runnable() {
                    @Override
                    public void run() {
                        handle(socket);
                    }
                });
            } catch (IOException e) {
                if (running) e.printStackTrace();
            }
        }
    }

    public int getPort() {
        return port;
    }

    public int getLanPort() {
        return lanPort;
    }

    public String getDeviceId() {
        return deviceId;
    }

    public void stop() {
        running = false;
        try {
            if (serverSocket != null) serverSocket.close();
        } catch (IOException ignored) {
        }
        try {
            if (lanSocket != null) lanSocket.close();
        } catch (IOException ignored) {
        }
        if (udp != null) udp.close();
        if (pool != null) pool.shutdownNow();
        if (multicastLock != null && multicastLock.isHeld()) {
            try {
                multicastLock.release();
            } catch (Exception ignored) {
            }
        }
    }

    /* ---------------- HTTP ---------------- */

    private void handle(Socket socket) {
        try {
            socket.setSoTimeout(30000);
            BufferedInputStream in = new BufferedInputStream(socket.getInputStream());
            ByteArrayOutputStream headBuf = new ByteArrayOutputStream();
            int state = 0; // 匹配 \r\n\r\n
            int b;
            while ((b = in.read()) != -1) {
                headBuf.write(b);
                if ((state == 0 || state == 2) && b == '\r') state++;
                else if ((state == 1 || state == 3) && b == '\n') state++;
                else state = (b == '\r') ? 1 : 0;
                if (state == 4) break;
                if (headBuf.size() > 32768) break;
            }
            String head = new String(headBuf.toByteArray(), StandardCharsets.UTF_8);
            String[] lines = head.split("\r\n");
            if (lines.length == 0) return;
            String[] parts = lines[0].split(" ");
            if (parts.length < 2) return;
            String method = parts[0];
            String path = parts[1];
            String query = "";
            int q = path.indexOf('?');
            if (q >= 0) {
                query = path.substring(q + 1);
                path = path.substring(0, q);
            }

            Map<String, String> headers = new HashMap<String, String>();
            for (int i = 1; i < lines.length; i++) {
                int c = lines[i].indexOf(':');
                if (c > 0) {
                    headers.put(lines[i].substring(0, c).trim().toLowerCase(),
                            lines[i].substring(c + 1).trim());
                }
            }

            OutputStream out = socket.getOutputStream();

            if (path.startsWith("/lan/")) {
                handleLan(out, in, method, path, query, headers);
                return;
            }

            if (!"GET".equals(method)) {
                writeResponse(out, 405, "text/plain; charset=utf-8",
                        "Method Not Allowed".getBytes(StandardCharsets.UTF_8), false);
                return;
            }
            if (path.equals("/")) path = "/index.html";
            if (path.equals("/favicon.ico")) {
                writeResponse(out, 204, "text/plain", new byte[0], false);
                return;
            }
            byte[] data = assetBytes("www" + path);
            if (data == null) {
                writeResponse(out, 404, "text/plain; charset=utf-8",
                        "Not Found".getBytes(StandardCharsets.UTF_8), false);
            } else {
                String etag = etagOf(data);
                String cc = cacheControlFor(path);
                if (etag.equals(headers.get("if-none-match"))) {
                    /* 内容没变只回 304，WebView 不用重新解析 800 KB 的首页 */
                    String head304 = "HTTP/1.1 304 Not Modified\r\nETag: " + etag
                            + "\r\nCache-Control: " + cc
                            + "\r\nConnection: close\r\n\r\n";
                    out.write(head304.getBytes(StandardCharsets.UTF_8));
                    out.flush();
                } else {
                    writeAssetResponse(out, mimeOf(path), data, etag, cc);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "handle error: " + e.getMessage());
        } finally {
            try {
                socket.close();
            } catch (IOException ignored) {
            }
        }
    }

    private void handleLan(OutputStream out, InputStream in, String method, String path,
                           String query, Map<String, String> headers) throws IOException {
        if ("OPTIONS".equals(method)) {
            writeResponse(out, 204, "text/plain", new byte[0], true);
            return;
        }

        if (path.equals("/lan/info")) {
            String json = "{\"id\":\"" + jsonEsc(deviceId) + "\",\"name\":\"" + jsonEsc(deviceName)
                    + "\",\"ip\":\"" + getLocalIp() + "\",\"port\":" + lanPort
                    + ",\"api\":1,\"dir\":\"" + jsonEsc(lanDir.getAbsolutePath()) + "\"}";
            writeResponse(out, 200, "application/json; charset=utf-8",
                    json.getBytes(StandardCharsets.UTF_8), true);
            return;
        }

        if (path.equals("/lan/files")) {
            if (!"GET".equals(method)) {
                writeResponse(out, 405, "text/plain; charset=utf-8",
                        "Method Not Allowed".getBytes(StandardCharsets.UTF_8), true);
                return;
            }
            writeResponse(out, 200, "application/json; charset=utf-8",
                    filesJson().getBytes(StandardCharsets.UTF_8), true);
            return;
        }

        if (path.equals("/lan/file")) {
            if (!"GET".equals(method)) {
                writeResponse(out, 405, "text/plain; charset=utf-8",
                        "Method Not Allowed".getBytes(StandardCharsets.UTF_8), true);
                return;
            }
            File f = safeLanFile(queryParam(query, "path"));
            if (f == null || !f.isFile() || f.length() > 2 * 1024 * 1024L) {
                writeResponse(out, 404, "text/plain; charset=utf-8",
                        "Not Found".getBytes(StandardCharsets.UTF_8), true);
                return;
            }
            writeResponse(out, 200, "text/plain; charset=utf-8", readFile(f), true);
            return;
        }

        if (path.equals("/lan/peers")) {
            writeResponse(out, 200, "application/json; charset=utf-8",
                    peersJson().getBytes(StandardCharsets.UTF_8), true);
            return;
        }

        if (path.equals("/lan/clients")) {
            writeResponse(out, 200, "application/json; charset=utf-8",
                    clientsJson().getBytes(StandardCharsets.UTF_8), true);
            return;
        }

        /* 浏览器设备（iPhone / iPad 用 Safari 打开本机地址）的数据存取 */
        if (path.equals("/lan/client/snapshot")) {
            String cid = queryParam(query, "client");
            if (!validClientId(cid)) {
                writeResponse(out, 400, "text/plain", new byte[0], true);
                return;
            }
            File dir = new File(clientsDir, cid);
            File f = new File(dir, "snapshot.json");
            if ("GET".equals(method)) {
                byte[] body = f.exists() ? readFile(f) : "{}".getBytes(StandardCharsets.UTF_8);
                writeResponse(out, 200, "application/json; charset=utf-8", body, true);
                return;
            }
            if ("POST".equals(method)) {
                byte[] body = readBody(in, headers, 16 * 1024 * 1024);
                if (body == null) {
                    writeResponse(out, 400, "text/plain", new byte[0], true);
                    return;
                }
                if (!dir.exists()) dir.mkdirs();
                writeFileAtomic(f, body);
                String name = queryParam(query, "name");
                if (name != null && !name.trim().isEmpty()) {
                    writeFileAtomic(new File(dir, "name.txt"),
                            name.trim().getBytes(StandardCharsets.UTF_8));
                }
                writeResponse(out, 200, "application/json; charset=utf-8",
                        "{\"ok\":true}".getBytes(StandardCharsets.UTF_8), true);
                return;
            }
        }

        if (path.equals("/lan/client/media")) {
            String cid = queryParam(query, "client");
            String id = queryParam(query, "id");
            String type = queryParam(query, "type");
            if (!validClientId(cid) || !validClientId(id)) {
                writeResponse(out, 400, "text/plain", new byte[0], true);
                return;
            }
            File dir = new File(new File(clientsDir, cid), "media");
            String ext = "video".equals(type) ? ".mp4" : ".jpg";
            File f = new File(dir, id + ext);
            String mime = "video".equals(type) ? "video/mp4" : "image/jpeg";
            if ("GET".equals(method)) {
                if (!f.exists()) {
                    writeResponse(out, 404, "text/plain", new byte[0], true);
                    return;
                }
                writeMediaStream(out, f, mime);
                return;
            }
            if ("POST".equals(method)) {
                if (!dir.exists()) dir.mkdirs();
                if (receiveMedia(in, out, headers, f)) {
                    writeResponse(out, 200, "application/json; charset=utf-8",
                            "{\"ok\":true}".getBytes(StandardCharsets.UTF_8), true);
                }
                return;
            }
        }

        if (path.equals("/lan/snapshot")) {
            File f = new File(lanDir, "snapshot.json");
            if ("GET".equals(method)) {
                byte[] body = f.exists() ? readFile(f) : "{}".getBytes(StandardCharsets.UTF_8);
                writeResponse(out, 200, "application/json; charset=utf-8", body, true);
                return;
            }
            if ("POST".equals(method)) {
                byte[] body = readBody(in, headers, 16 * 1024 * 1024);
                if (body == null) {
                    writeResponse(out, 400, "text/plain", new byte[0], true);
                    return;
                }
                writeFileAtomic(f, body);
                writeResponse(out, 200, "application/json; charset=utf-8",
                        "{\"ok\":true}".getBytes(StandardCharsets.UTF_8), true);
                return;
            }
        }

        if (path.equals("/lan/media")) {
            String id = queryParam(query, "id");
            String type = queryParam(query, "type");
            if (id == null || id.isEmpty() || !id.matches("[A-Za-z0-9_.-]{1,80}")) {
                writeResponse(out, 400, "text/plain", new byte[0], true);
                return;
            }
            String ext = "video".equals(type) ? ".mp4" : ".jpg";
            File f = new File(mediaDir, id + ext);
            if ("GET".equals(method)) {
                if (!f.exists()) {
                    writeResponse(out, 404, "text/plain", new byte[0], true);
                    return;
                }
                OutputStream raw = out;
                String mime = "video".equals(type) ? "video/mp4" : "image/jpeg";
                String head = "HTTP/1.1 200 OK\r\nContent-Type: " + mime
                        + "\r\nContent-Length: " + f.length()
                        + "\r\nAccess-Control-Allow-Origin: *"
                        + "\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n";
                raw.write(head.getBytes(StandardCharsets.UTF_8));
                FileInputStream fis = new FileInputStream(f);
                byte[] buf = new byte[16384];
                int n;
                while ((n = fis.read(buf)) > 0) raw.write(buf, 0, n);
                fis.close();
                raw.flush();
                return;
            }
            if ("POST".equals(method)) {
                long len = parseLen(headers);
                if (len <= 0) {
                    writeResponse(out, 400, "text/plain", new byte[0], true);
                    return;
                }
                File tmp = new File(mediaDir, id + ext + ".part");
                FileOutputStream fos = new FileOutputStream(tmp);
                byte[] buf = new byte[16384];
                long left = len;
                while (left > 0) {
                    int n = in.read(buf, 0, (int) Math.min(buf.length, left));
                    if (n <= 0) break;
                    fos.write(buf, 0, n);
                    left -= n;
                }
                fos.close();
                if (tmp.length() == 0) {
                    tmp.delete();
                    writeResponse(out, 400, "text/plain", new byte[0], true);
                    return;
                }
                if (f.exists()) f.delete();
                tmp.renameTo(f);
                writeResponse(out, 200, "application/json; charset=utf-8",
                        "{\"ok\":true}".getBytes(StandardCharsets.UTF_8), true);
                return;
            }
        }

        writeResponse(out, 404, "text/plain; charset=utf-8",
                "Not Found".getBytes(StandardCharsets.UTF_8), true);
    }

    private String peersJson() {
        long now = System.currentTimeMillis();
        StringBuilder sb = new StringBuilder("[");
        boolean first = true;
        for (Peer p : peers.values()) {
            if (now - p.seen > PEER_TTL || p.id.equals(deviceId)) continue;
            if (!first) sb.append(',');
            first = false;
            sb.append("{\"ip\":\"").append(jsonEsc(p.ip)).append("\",\"port\":").append(p.port)
                    .append(",\"id\":\"").append(jsonEsc(p.id)).append("\"}");
        }
        sb.append(']');
        return sb.toString();
    }

    private boolean validClientId(String id) {
        return id != null && !id.isEmpty()
                && id.matches("[A-Za-z0-9_-][A-Za-z0-9_.-]{0,59}")
                && !id.contains("..");
    }

    /** 已通过浏览器接入的手机（iPhone / iPad）列表，10 分钟未更新视为离线 */
    private String clientsJson() {
        long now = System.currentTimeMillis();
        StringBuilder sb = new StringBuilder("[");
        boolean first = true;
        File[] dirs = clientsDir.listFiles();
        if (dirs != null) {
            for (File d : dirs) {
                if (!d.isDirectory()) continue;
                File snap = new File(d, "snapshot.json");
                if (!snap.exists()) continue;
                if (now - snap.lastModified() > 10 * 60 * 1000L) continue;
                String name = d.getName();
                File nf = new File(d, "name.txt");
                if (nf.exists()) {
                    try {
                        String s = new String(readFile(nf), StandardCharsets.UTF_8).trim();
                        if (!s.isEmpty()) name = s;
                    } catch (Exception ignored) {
                    }
                }
                if (!first) sb.append(',');
                first = false;
                sb.append("{\"id\":\"").append(jsonEsc(d.getName()))
                        .append("\",\"name\":\"").append(jsonEsc(name))
                        .append("\",\"ip\":\"").append(getLocalIp())
                        .append("\",\"port\":").append(lanPort)
                        .append(",\"ts\":").append(snap.lastModified()).append('}');
            }
        }
        sb.append(']');
        return sb.toString();
    }

    private File safeLanFile(String rel) {
        if (rel == null || rel.isEmpty() || rel.startsWith("/") || rel.contains("..")) return null;
        File f = new File(lanDir, rel.replace('/', File.separatorChar));
        try {
            String root = lanDir.getCanonicalPath() + File.separator;
            if (!f.getCanonicalPath().startsWith(root)) return null;
        } catch (IOException e) {
            return null;
        }
        return f;
    }

    /** 共享文件夹内容清单，供「局域网互传 → 共享数据文件夹」页查看 */
    private String filesJson() {
        List<File> files = new ArrayList<File>();
        collectFiles(lanDir, 0, files);
        StringBuilder sb = new StringBuilder(512);
        sb.append("{\"dir\":\"").append(jsonEsc(lanDir.getAbsolutePath())).append("\",\"files\":[");
        boolean first = true;
        String root = lanDir.getAbsolutePath();
        for (File f : files) {
            if (!first) sb.append(',');
            first = false;
            String rel = f.getAbsolutePath();
            if (rel.startsWith(root + File.separator)) rel = rel.substring(root.length() + 1);
            String name = f.getName();
            String lower = name.toLowerCase();
            String kind = "file";
            if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png")
                    || lower.endsWith(".webp") || lower.endsWith(".gif")) {
                kind = "image";
            } else if (lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov")) {
                kind = "video";
            } else if (lower.endsWith(".json") || lower.endsWith(".txt") || lower.endsWith(".id")) {
                kind = "text";
            }
            sb.append("{\"path\":\"").append(jsonEsc(rel.replace(File.separatorChar, '/')))
                    .append("\",\"name\":\"").append(jsonEsc(name))
                    .append("\",\"size\":").append(f.length())
                    .append(",\"mtime\":").append(f.lastModified())
                    .append(",\"kind\":\"").append(kind).append("\"}");
        }
        sb.append("]}");
        return sb.toString();
    }

    private void collectFiles(File dir, int depth, List<File> out) {
        if (depth > 3 || out.size() >= 600) return;
        File[] list = dir.listFiles();
        if (list == null) return;
        for (File f : list) {
            if (out.size() >= 600) return;
            if (f.isDirectory()) {
                collectFiles(f, depth + 1, out);
            } else if (f.isFile()) {
                out.add(f);
            }
        }
    }

    private void writeMediaStream(OutputStream out, File f, String mime) throws IOException {
        String head = "HTTP/1.1 200 OK\r\nContent-Type: " + mime
                + "\r\nContent-Length: " + f.length()
                + "\r\nAccess-Control-Allow-Origin: *"
                + "\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n";
        out.write(head.getBytes(StandardCharsets.UTF_8));
        FileInputStream fis = new FileInputStream(f);
        byte[] buf = new byte[16384];
        int n;
        while ((n = fis.read(buf)) > 0) out.write(buf, 0, n);
        fis.close();
        out.flush();
    }

    /** 流式接收上传文件，成功返回 true 并由调用方写 200；失败时已写 400 */
    private boolean receiveMedia(InputStream in, OutputStream out, Map<String, String> headers, File f)
            throws IOException {
        long len = parseLen(headers);
        if (len <= 0) {
            writeResponse(out, 400, "text/plain", new byte[0], true);
            return false;
        }
        File tmp = new File(f.getParentFile(), f.getName() + ".part");
        FileOutputStream fos = new FileOutputStream(tmp);
        byte[] buf = new byte[16384];
        long left = len;
        while (left > 0) {
            int n = in.read(buf, 0, (int) Math.min(buf.length, left));
            if (n <= 0) break;
            fos.write(buf, 0, n);
            left -= n;
        }
        fos.close();
        if (tmp.length() == 0) {
            tmp.delete();
            writeResponse(out, 400, "text/plain", new byte[0], true);
            return false;
        }
        if (f.exists()) f.delete();
        tmp.renameTo(f);
        return true;
    }

    private String queryParam(String query, String name) {
        if (query == null || query.isEmpty()) return null;
        for (String kv : query.split("&")) {
            int i = kv.indexOf('=');
            if (i <= 0) continue;
            if (kv.substring(0, i).equals(name)) {
                try {
                    return java.net.URLDecoder.decode(kv.substring(i + 1), "UTF-8");
                } catch (Exception e) {
                    return kv.substring(i + 1);
                }
            }
        }
        return null;
    }

    private long parseLen(Map<String, String> headers) {
        try {
            String v = headers.get("content-length");
            return v == null ? -1 : Long.parseLong(v.trim());
        } catch (Exception e) {
            return -1;
        }
    }

    private byte[] readBody(InputStream in, Map<String, String> headers, int max) throws IOException {
        long len = parseLen(headers);
        if (len < 0 || len > max) return null;
        ByteArrayOutputStream bos = new ByteArrayOutputStream((int) len);
        byte[] buf = new byte[8192];
        long left = len;
        while (left > 0) {
            int n = in.read(buf, 0, (int) Math.min(buf.length, left));
            if (n <= 0) break;
            bos.write(buf, 0, n);
            left -= n;
        }
        return bos.toByteArray();
    }

    private void writeResponse(OutputStream out, int code, String type, byte[] body, boolean cors)
            throws IOException {
        String status = code == 200 ? "200 OK"
                : code == 204 ? "204 No Content"
                : code == 400 ? "400 Bad Request"
                : code == 405 ? "405 Method Not Allowed"
                : "404 Not Found";
        StringBuilder sb = new StringBuilder();
        sb.append("HTTP/1.1 ").append(status).append("\r\n");
        sb.append("Content-Type: ").append(type).append("\r\n");
        sb.append("Content-Length: ").append(body.length).append("\r\n");
        sb.append("Cache-Control: no-store\r\n");
        if (cors) {
            sb.append("Access-Control-Allow-Origin: *\r\n");
            sb.append("Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n");
            sb.append("Access-Control-Allow-Headers: Content-Type\r\n");
        }
        sb.append("Connection: close\r\n\r\n");
        out.write(sb.toString().getBytes(StandardCharsets.UTF_8));
        if (body.length > 0) out.write(body);
        out.flush();
    }

    /* ---------------- 设备发现 ---------------- */

    private void startDiscovery() {
        try {
            WifiManager wm = (WifiManager) ctx.getSystemService(Context.WIFI_SERVICE);
            if (wm != null) {
                multicastLock = wm.createMulticastLock("u-lan");
                multicastLock.setReferenceCounted(false);
                multicastLock.acquire();
            }
        } catch (Exception e) {
            Log.w(TAG, "multicast lock failed: " + e.getMessage());
        }

        try {
            udp = new DatagramSocket(null);
            udp.setReuseAddress(true);
            udp.bind(new InetSocketAddress(DISCOVERY_PORT));
            udp.setBroadcast(true);
        } catch (Exception e) {
            Log.w(TAG, "udp bind failed: " + e.getMessage());
            udp = null;
            return;
        }

        discoveryThread = new Thread(new Runnable() {
            @Override
            public void run() {
                byte[] buf = new byte[512];
                while (running) {
                    try {
                        DatagramPacket pkt = new DatagramPacket(buf, buf.length);
                        udp.receive(pkt);
                        String msg = new String(pkt.getData(), 0, pkt.getLength(), StandardCharsets.UTF_8);
                        String[] p = msg.split("\\|");
                        boolean isReply = p.length >= 3 && "UR".equals(p[0]);
                        if (p.length >= 3 && ("U".equals(p[0]) || isReply)) {
                            String id = p[1];
                            int port = Integer.parseInt(p[2]);
                            String ip = pkt.getAddress().getHostAddress();
                            if (!id.equals(deviceId) && port > 0) {
                                peers.put(ip + ":" + port, new Peer(ip, port, id, System.currentTimeMillis()));
                                if (!isReply) {
                                    /* 单播回应一次，避免广播被路由器过滤时双方互相看不到 */
                                    String reply = "UR|" + deviceId + "|" + lanPort;
                                    byte[] rb = reply.getBytes(StandardCharsets.UTF_8);
                                    udp.send(new DatagramPacket(rb, rb.length, pkt.getAddress(), DISCOVERY_PORT));
                                }
                            }
                        }
                    } catch (Exception e) {
                        if (!running) return;
                    }
                }
            }
        }, "u-lan-discover");
        discoveryThread.setDaemon(true);
        discoveryThread.start();

        Thread sender = new Thread(new Runnable() {
            @Override
            public void run() {
                String payload = "U|" + deviceId + "|" + lanPort;
                byte[] data = payload.getBytes(StandardCharsets.UTF_8);
                while (running) {
                    try {
                        DatagramPacket pkt = new DatagramPacket(data, data.length,
                                InetAddress.getByName("255.255.255.255"), DISCOVERY_PORT);
                        udp.send(pkt);
                        for (InetAddress addr : broadcastAddresses()) {
                            try {
                                DatagramPacket p2 = new DatagramPacket(data, data.length, addr, DISCOVERY_PORT);
                                udp.send(p2);
                            } catch (Exception ignored) {
                            }
                        }
                    } catch (Exception ignored) {
                    }
                    try {
                        Thread.sleep(2500);
                    } catch (InterruptedException e) {
                        return;
                    }
                }
            }
        }, "u-lan-beacon");
        sender.setDaemon(true);
        sender.start();
    }

    private List<InetAddress> broadcastAddresses() {
        List<InetAddress> out = new ArrayList<InetAddress>();
        try {
            Enumeration<NetworkInterface> nis = NetworkInterface.getNetworkInterfaces();
            while (nis != null && nis.hasMoreElements()) {
                NetworkInterface ni = nis.nextElement();
                if (ni.isLoopback() || !ni.isUp()) continue;
                for (java.net.InterfaceAddress ia : ni.getInterfaceAddresses()) {
                    if (ia.getBroadcast() != null) out.add(ia.getBroadcast());
                }
            }
        } catch (Exception ignored) {
        }
        return out;
    }

    private String getLocalIp() {
        try {
            Enumeration<NetworkInterface> nis = NetworkInterface.getNetworkInterfaces();
            while (nis != null && nis.hasMoreElements()) {
                NetworkInterface ni = nis.nextElement();
                if (ni.isLoopback() || !ni.isUp()) continue;
                Enumeration<InetAddress> addrs = ni.getInetAddresses();
                while (addrs.hasMoreElements()) {
                    InetAddress a = addrs.nextElement();
                    if (!a.isLoopbackAddress() && a instanceof java.net.Inet4Address) {
                        String ip = a.getHostAddress();
                        if (ip != null && !ip.startsWith("127.")) return ip;
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return "127.0.0.1";
    }

    /* ---------------- 文件 ---------------- */

    private byte[] readFile(File f) throws IOException {
        FileInputStream in = new FileInputStream(f);
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
        in.close();
        return bos.toByteArray();
    }

    private void writeFileAtomic(File f, byte[] data) throws IOException {
        File tmp = new File(f.getParentFile(), f.getName() + ".tmp");
        FileOutputStream out = new FileOutputStream(tmp);
        out.write(data);
        out.close();
        if (f.exists()) f.delete();
        tmp.renameTo(f);
    }

    private String jsonEsc(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
    }

    /** 先查内存缓存，没有再读 assets 并缓存（单文件 > 2 MB 不缓存，避免占内存） */
    private byte[] assetBytes(String path) {
        byte[] hit = assetCache.get(path);
        if (hit != null) return hit;
        byte[] data = readAsset(path);
        if (data != null && data.length <= 2 * 1024 * 1024
                && assetCacheUsed + data.length <= ASSET_CACHE_BYTES) {
            assetCacheUsed += data.length;
            assetCache.put(path, data);
        }
        return data;
    }

    /** 长度 + 抽样哈希：内容一变 ETag 就变，算起来也便宜 */
    private static String etagOf(byte[] data) {
        int step = Math.max(1, data.length / 96);
        int h = 17;
        for (int i = 0; i < data.length; i += step) h = h * 31 + data[i];
        return "\"" + Integer.toHexString(data.length) + "-" + Integer.toHexString(h) + "\"";
    }

    /** 前端资源随 App 版本变，靠 ETag 重新校验；第三方库可以长期用缓存 */
    private String cacheControlFor(String path) {
        if (path.startsWith("/vendor/")) return "public, max-age=604800";
        // app.js 由版本参数区分内容，长期缓存；index.html 每次校验
        if (path.startsWith("/app.js")) return "public, max-age=31536000, immutable";
        if (path.endsWith(".html") || path.endsWith(".js") || path.endsWith(".css")) return "no-cache";
        return "public, max-age=86400";
    }

    private void writeAssetResponse(OutputStream out, String mime, byte[] data,
                                   String etag, String cc) throws IOException {
        StringBuilder sb = new StringBuilder();
        sb.append("HTTP/1.1 200 OK\r\nContent-Type: ").append(mime)
                .append("\r\nContent-Length: ").append(data.length)
                .append("\r\nETag: ").append(etag)
                .append("\r\nCache-Control: ").append(cc)
                .append("\r\nConnection: close\r\n\r\n");
        out.write(sb.toString().getBytes(StandardCharsets.UTF_8));
        out.write(data);
        out.flush();
    }

    private byte[] readAsset(String path) {
        InputStream in = null;
        try {
            in = assets.open(path);
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
            return bos.toByteArray();
        } catch (IOException e) {
            return null;
        } finally {
            if (in != null) {
                try {
                    in.close();
                } catch (IOException ignored) {
                }
            }
        }
    }

    private String mimeOf(String path) {
        String p = path.toLowerCase();
        if (p.endsWith(".html")) return "text/html; charset=utf-8";
        if (p.endsWith(".js")) return "application/javascript; charset=utf-8";
        if (p.endsWith(".css")) return "text/css; charset=utf-8";
        if (p.endsWith(".json")) return "application/json; charset=utf-8";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".mp4")) return "video/mp4";
        if (p.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }
}
