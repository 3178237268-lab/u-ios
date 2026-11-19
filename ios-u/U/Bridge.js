/* U iOS 桥：把 window.UHost.* 变成同步 XHR 调用本地服务 /bridge/<方法>。
   本地服务与页面同源（都在 http://127.0.0.1:<port>），所以同步 XHR 不会被拦。 */
(function () {
  if (window.UHost && window.UHost.__ios) return;

  function call(name, args) {
    var q = [];
    (args || []).forEach(function (v, i) { q.push('a' + i + '=' + encodeURIComponent(v == null ? '' : String(v))); });
    var url = '/bridge/' + name + (q.length ? '?' + q.join('&') : '');
    try {
      var x = new XMLHttpRequest();
      x.open('GET', url, false);
      x.send(null);
      return x.responseText || '';
    } catch (e) {
      return '';
    }
  }

  function arg(args, map) {
    var o = {};
    (map || []).forEach(function (k, i) { o[k] = args[i] == null ? '' : String(args[i]); });
    return o;
  }

  function q(o) {
    var parts = [];
    Object.keys(o).forEach(function (k) { parts.push(k + '=' + encodeURIComponent(o[k] == null ? '' : String(o[k]))); });
    return parts.join('&');
  }

  function callObj(name, o) {
    try {
      var x = new XMLHttpRequest();
      x.open('GET', '/bridge/' + name + (o ? '?' + q(o) : ''), false);
      x.send(null);
      return x.responseText || '';
    } catch (e) { return ''; }
  }

  var H = {
    __ios: true,
    openUrl: function (u) { callObj('openUrl', { url: u }); },
    setTheme: function (d) { callObj('setTheme', { dark: d ? '1' : '0' }); },
    setImmersive: function () { },
    setLandscape: function () { },
    setPortrait: function () { },
    refreshInfo: function () { return callObj('refreshInfo', {}); },
    localIp: function () { return callObj('localIp', {}); },
    discoveredServer: function () { return callObj('discoveredServer', {}); },
    rescanServer: function () { return callObj('rescanServer', {}); },
    deviceInfo: function () { return callObj('deviceInfo', {}); },
    hasGalleryPermission: function () { return callObj('hasGalleryPermission', {}) === 'true'; },
    listGallery: function (limit) { return callObj('listGallery', { limit: limit }); },
    readGalleryItem: function (gid, maxPx) { return callObj('readGalleryItem', { gid: gid, maxPx: maxPx }); },
    listGalleryThumbs: function (limit) { return callObj('listGalleryThumbs', { limit: limit }); },
    listGalleryThumbsPage: function (offset, limit) { return callObj('listGalleryThumbsPage', { offset: offset, limit: limit }); },
    requestSnap: function (taskId) { return callObj('requestSnap', { taskId: taskId }) === 'true'; },
    downloadMedia: function (url, name) { return callObj('downloadMedia', { url: url, name: name }); },
    downloadState: function (id) { return callObj('downloadState', { id: id }); },
    openDownloaded: function (name) { return callObj('openDownloaded', { name: name }) === 'true'; },
    openDownloadFolder: function (name) { return callObj('openDownloadFolder', { name: name }); },
    deleteDownloaded: function (name) { return callObj('deleteDownloaded', { name: name }); },
    listApks: function () { return callObj('listApks', {}); },
    saveApkBase64: function (b64, name) { return callObj('saveApkBase64', { b64: b64, name: name }) === 'true'; },
    installApk: function (name) { return callObj('installApk', { name: name }); },
    deleteApkEx: function (name) { return callObj('deleteApkEx', { name: name }); },
    deleteApk: function (name) { return callObj('deleteApk', { name: name }) === 'true'; },
    cacheScan: function () { return callObj('cacheScan', {}); },
    cacheDelete: function (json) { return callObj('cacheDelete', { paths: json }); },
    clearWebCache: function () { callObj('clearWebCache', {}); }
  };

  window.UHost = H;
  try { console.log('[U] iOS 桥就绪'); } catch (e) { }
})();
