(() => {
  'use strict';
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const KEY = 'oms_v1', LIMIT = 45000;
  const GR = [[50, 'PERFECT', 100], [150, 'INSANE', 80], [300, 'GREAT', 60], [500, 'GOOD', 40], [800, 'NICE', 20]];
  const fmt = n => n.toLocaleString('en-US'), f2 = ms => (ms / 1000).toFixed(2);
  const mult = c => c >= 8 ? 3 : c >= 5 ? 2 : c >= 3 ? 1.5 : 1;

  // ---- storage (corruption-safe) ----
  const ok = v => v != null && Number.isFinite(+v) && +v >= 0;
  function load() {
    const z = { best: 0, minErr: null, plays: 0, perfects: 0 };
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (!d || typeof d !== 'object') return z;
      return { best: ok(d.best) ? +d.best : 0, minErr: ok(d.minErr) ? +d.minErr : null, plays: ok(d.plays) ? +d.plays : 0, perfects: ok(d.perfects) ? +d.perfects : 0 };
    } catch (e) { return z; }
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(R)); } catch (e) {} };
  let R = load();

  // ---- helpers ----
  let timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const clr = () => { timers.forEach(clearTimeout); timers = []; };
  let ac;
  function beep(f = 660, d = .08) {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = f; g.gain.value = .05; o.connect(g); g.connect(ac.destination);
      o.start(); o.stop(ac.currentTime + d);
    } catch (e) {}
  }

  let S = { screen: 'title', live: false, phase: 'idle', mode: 'attack', rounds: [], score: 0, combo: 0 };

  function show(n) {
    clr(); S.screen = n;
    $$('.screen').forEach(s => s.classList.toggle('on', s.id === n));
    document.body.classList.toggle('live', S.live && S.mode === 'attack' && (n === 'play' || n === 'judge'));
    if (n === 'title') {
      $('#rec').innerHTML = `SCORE ATTACK 自己ベスト　${fmt(R.best)}<br>ONE SHOT 最小誤差　${R.minErr == null ? '-' : f2(R.minErr) + '秒'}<br>プレイ ${R.plays}回　PERFECT ${R.perfects}回`;
    }
  }

  // ---- flow ----
  function begin(mode) {
    S = { screen: 'ready', live: false, phase: 'idle', mode, rounds: [], score: 0, combo: 0, over: false };
    show('ready');
    $('#cdt').textContent = mode === 'attack' ? '45秒。目標の秒数を心の中で数える。' : '挑戦は1回だけ。';
    const step = n => {
      $('#cd').textContent = n || 'GO'; beep(n ? 440 : 880);
      later(() => n ? step(n - 1) : launch(), n ? 750 : 450);
    };
    step(3);
  }

  function launch() { S.live = true; S.g0 = performance.now(); round(); }

  function round() {
    S.target = S.mode === 'attack' ? 2 + Math.floor(Math.random() * 11) / 2 : 2 + Math.floor(Math.random() * 17) / 2;
    S.phase = 'idle';
    $('#tgt').textContent = S.target.toFixed(1);
    $('#tap').textContent = 'START'; $('#tap').classList.remove('run');
    $('#hint').textContent = 'START を押して、目標の秒数を数える';
    hud(); show('play');
  }

  function hud() {
    $('#hS').textContent = fmt(S.score);
    $('#hC').textContent = S.combo ? `COMBO ${S.combo} ×${mult(S.combo)}` : '';
  }

  function act() {
    if (S.screen !== 'play' || !S.live) return;
    const t = performance.now();
    if (S.phase === 'idle') {
      S.phase = 'running'; S.t0 = t;
      $('#tap').textContent = 'TAP'; $('#tap').classList.add('run');
      $('#hint').textContent = '数えて。ここだと思ったらタップ。';
      beep(520);
    } else if (S.phase === 'running') {
      if (t - S.t0 < 150) return;            // 誤タップ・二重タップ防止
      S.phase = 'locked';                    // 以降の入力を無効化
      judge(t - S.t0);
    }
  }

  function judge(el) {
    const err = Math.abs(el - S.target * 1000);
    const g = GR.find(x => err <= x[0]) || [0, 'MISS', 0];
    S.combo = g[2] > 0 ? S.combo + 1 : 0;
    const gained = Math.round(g[2] * (g[2] > 0 ? mult(S.combo) : 1));
    S.score += gained;
    S.rounds.push({ err, name: g[1], pts: g[2] });
    $('#gr').textContent = g[1]; $('#gr').className = g[1];
    $('#er').textContent = (el >= S.target * 1000 ? '+' : '-') + f2(err);
    $('#pt').textContent = `実測 ${f2(el)}秒 / 目標 ${S.target.toFixed(1)}秒　` + (S.mode === 'attack' ? `+${gained}` : `${g[2]}点`);
    beep(g[2] ? 880 : 200, .12);
    hud(); show('judge');
    later(() => (S.mode === 'oneshot' || S.over) ? end() : round(), S.mode === 'attack' ? 1100 : 1500);
  }

  function titleOf(mode, score, errMs) {
    if (mode === 'attack') return score < 150 ? 'SLEEPWALKER' : score < 400 ? 'TICK TOCK' : score < 700 ? 'CLOCKWORK' : score < 1000 ? 'TIME MASTER' : 'TIME LORD';
    return errMs <= 50 ? 'TIME LORD' : errMs <= 150 ? 'TIME MASTER' : errMs <= 300 ? 'CLOCKWORK' : errMs <= 500 ? 'TICK TOCK' : 'SLEEPWALKER';
  }

  function end() {
    S.live = false; S.phase = 'locked';
    const rs = S.rounds, n = rs.length;
    const avg = n ? rs.reduce((a, r) => a + r.err, 0) / n : null;
    const bestErr = n ? Math.min(...rs.map(r => r.err)) : null;
    const perfects = rs.filter(r => r.name === 'PERFECT').length;
    const score = S.mode === 'attack' ? S.score : (n ? rs[0].pts : 0);
    let nb = false;
    R.plays++; R.perfects += perfects;
    if (S.mode === 'attack') { if (score > R.best) { R.best = score; nb = score > 0; } }
    else if (bestErr != null && (R.minErr == null || bestErr < R.minErr)) { R.minErr = bestErr; nb = true; }
    save();
    const title = titleOf(S.mode, score, bestErr == null ? 9999 : bestErr);
    const bestTxt = S.mode === 'attack' ? fmt(R.best) : (R.minErr == null ? '-' : f2(R.minErr) + '秒差');
    const stats = [['自己ベスト', bestTxt], ['PERFECT', perfects + '回'], ['平均誤差', avg == null ? '-' : f2(avg) + '秒']];
    const big = S.mode === 'attack' ? fmt(score) : (bestErr == null ? '-' : f2(bestErr));
    const bigLabel = S.mode === 'attack' ? 'SCORE' : '秒差';
    S.share = {
      big, bigLabel, title, stats,
      text: `ONE MORE SECONDに挑戦！\n\nSCORE：${fmt(score)}\nTITLE：${title}\nBEST：${bestErr == null ? '-' : f2(bestErr)}秒差\n\nあなたは何秒差を出せる？\n\n#ONEMORESECOND`
    };
    $('#rNew').textContent = nb ? 'NEW BEST' : title;
    $('#rBig').textContent = big; $('#rLbl').textContent = bigLabel;
    $('#rGrid').innerHTML = [...stats, ['称号', title]].map(([l, v]) => `<div class="cell"><span>${l}</span><b>${v}</b></div>`).join('');
    $('#shareMsg').textContent = '';
    show('result');
  }

  async function doShare() {
    const b = $('#shareBtn'); if (b.disabled || !S.share) return;
    b.disabled = true; $('#shareMsg').textContent = '画像を生成中…';
    try {
      const r = await OMS_Share.share(S.share);
      $('#shareMsg').innerHTML = { shared: '共有しました。', cancel: '', downloaded: '画像を保存し、Xの投稿画面を開きました。投稿に画像を添付してください。',
        blocked: `画像を保存しました。<a style="color:#B8F45B" target="_blank" rel="noopener" href="${OMS_Share.share.xUrl}">Xの投稿画面を開く</a>` }[r] || '';
    } catch (e) { $('#shareMsg').textContent = '画像の生成に失敗しました。もう一度お試しください。'; }
    b.disabled = false;
  }

  // ---- display loop (rAF is for display only; timing uses performance.now) ----
  function loop() {
    if (S.live && S.mode === 'attack') {
      const el = performance.now() - S.g0, left = Math.max(0, LIMIT - el);
      $('#bar').style.transform = `scaleX(${left / LIMIT})`;
      $('#hT').textContent = (left / 1000).toFixed(1);
      if (el >= LIMIT) { if (S.phase === 'locked') S.over = true; else end(); }  // 未完了の問題は無効
    }
    requestAnimationFrame(loop);
  }

  // ---- input ----
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.go) show(b.dataset.go);
    else if (b.dataset.start) begin(b.dataset.start);
    else if (b.dataset.retry) begin(S.mode);
    else if (b.id === 'shareBtn') doShare();
    b.blur();
  });
  $('#play').addEventListener('pointerdown', e => { e.preventDefault(); act(); });
  document.addEventListener('keydown', e => {
    if (e.code !== 'Space') return;
    e.preventDefault(); if (e.repeat) return;
    if (S.screen === 'play') act(); else if (S.screen === 'title') show('mode');
  });
  document.addEventListener('keyup', e => { if (e.code === 'Space') e.preventDefault(); });

  show('title'); loop();
})();
