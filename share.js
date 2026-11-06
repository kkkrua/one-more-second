(() => {
  'use strict';
  const W = 1200, H = 630;
  const F = '"Helvetica Neue",Arial,"Hiragino Sans","Noto Sans JP",sans-serif';
  const gameUrl = () => location.origin + location.pathname;
  function rr(x, px, py, w, h, r) {
    x.beginPath(); x.moveTo(px + r, py);
    x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r);
    x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath();
  }
  function makeImage(d) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#101114'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#1B1D22'; rr(x, 40, 40, W - 80, H - 80, 36); x.fill();
    x.fillStyle = '#B8F45B'; x.font = '800 36px ' + F; x.textAlign = 'left';
    x.fillText('ONE MORE SECOND', 96, 120);
    x.fillStyle = '#888B91'; x.font = '24px ' + F; x.textAlign = 'right';
    x.fillText(gameUrl().replace(/^https?:\/\//, ''), W - 96, 120);
    x.textAlign = 'left';
    x.fillStyle = '#FFFFFF'; x.font = `900 ${String(d.big).length > 8 ? 112 : 150}px ${F}`;
    x.fillText(d.big, 90, 320);
    x.fillStyle = '#888B91'; x.font = '28px ' + F; x.fillText(d.bigLabel, 96, 366);
    x.fillStyle = '#B8F45B'; x.font = '800 52px ' + F; x.fillText(d.title, 96, 440);
    d.stats.forEach(([l, v], i) => {
      const px = 96 + i * 340;
      x.fillStyle = '#888B91'; x.font = '24px ' + F; x.fillText(l, px, 504);
      x.fillStyle = '#FFFFFF'; x.font = '700 40px ' + F; x.fillText(v, px, 552);
    });
    return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('png')), 'image/png'));
  }
  const xIntent = text => 'https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(gameUrl());
  async function share(d) {
    const blob = await makeImage(d);
    const file = new File([blob], 'one-more-second.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: d.text + '\n' + gameUrl() });
        return 'shared';
      } catch (e) {
        if (e && e.name === 'AbortError') return 'cancel';
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'one-more-second.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    const xUrl = xIntent(d.text);
    const w = window.open(xUrl, '_blank', 'noopener');
    return w ? 'downloaded' : 'blocked';
  }
  window.OMS_Share = { makeImage, share, xIntent };
})();
