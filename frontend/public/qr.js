/* Thin wrapper over vendored qrcode.js (Kazuhiko Arase, MIT).
   Renders a QR of `str` to a <canvas>. Used to show the RG number as a scannable code. */
(function (global) {
  function toCanvas(str, opts = {}) {
    const scale = opts.scale || 6, margin = opts.margin || 4;
    const qr = global.qrcode(0, 'M'); // type 0 = auto-size, ECC level M
    qr.addData(str);
    qr.make();
    const n = qr.getModuleCount();
    const px = (n + margin * 2) * scale;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = px;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
      if (qr.isDark(r, c)) ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
    return canvas;
  }
  global.QR = { toCanvas };
})(window);
