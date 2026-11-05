(() => {
  'use strict';
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const KEY = 'oms_v1', LIMIT = 45000;
  const GR = [[50, 'PERFECT', 100], [150, 'INSANE', 80], [300, 'GREAT', 60], [500, 'GOOD', 40], [800, 'NICE', 20]];
  const fmt = n => n.toLocaleString('en-US'), f2 = ms => (ms / 1000).toFixed(2);
  const tolOf = n => Math.max(50, Math.round(800 * Math.pow(0.93, n)));  // SURVIVAL: n=クリア済み数
  const mult = c => c >= 8 ? 3 : c >= 5 ? 2 : c >= 3 ? 1.5 : 1;

  // ---- storage (corruption-safe) ----
  const ok = v => v != null && Number.isFinite(+v) && +v >= 0;
  function load() {
    const z = { best: 0, surv: 0, minErr: null, plays: 0, perfects: 0 };
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (!d || typeof d !== 'object') return z;
      return { best: ok(d.best) ? +d.best : 0, surv: ok(d.surv) ? +d.surv : 0, minErr: ok(d.minErr) ? +d.minErr : null, plays: ok(d.plays) ? +d.plays : 0, perfects: ok(d.perfects) ? +d.perfects : 0 };
    } catch (e) { return z; }
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(R)); } catch (e) {} };
  let R = load();

  // ---- helpers ----
  let timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const clr = () => { timers.forEach(clearTimeout); timers = []; };
  let ac;
  // AudioContext はユーザー操作の中で作って resume する(最初の音が鳴らない・遅れて固まる対策)
  function unlock() {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
    } catch (e) {}
  }
  function beep(f = 660, d = .08) {
    try {
      unlock();
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + .02;
      o.frequency.value = f;
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(.15, t + .01);
      g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g); g.connect(ac.destination);
      o.start(t); o.stop(t + d + .02);
    } catch (e) {}
  }

  let S = { screen: 'title', live: false, phase: 'idle', mode: 'attack', rounds: [], score: 0, combo: 0 };

  function show(n) {
    clr(); S.screen = n;
    $$('.screen').forEach(s => s.classList.toggle('on', s.id === n));
    document.body.classList.toggle('live', S.live && (S.mode === 'attack' || S.mode === 'survival') && (n === 'play' || n === 'judge'));
    document.body.classList.toggle('surv', S.mode === 'survival');
    if (n === 'title') {
      $('#rec').innerHTML = `SCORE ATTACK 自己ベスト　${fmt(R.best)}<br>SURVIVAL 最高　${R.surv}連続<br>ONE SHOT 最小誤差　${R.minErr == null ? '-' : f2(R.minErr) + '秒'}<br>プレイ ${R.plays}回　PERFECT ${R.perfects}回`;
    }
  }

  // ---- flow ----
  function begin(mode) {
    S = { screen: 'ready', live: false, phase: 'idle', mode, rounds: [], score: 0, combo: 0, over: false, cleared: 0, fail: false };
    show('ready');
    $('#cdt').textContent = mode === 'attack' ? '45秒。目標の秒数を心の中で数える。' : mode === 'survival' ? '許容誤差は少しずつ狭くなる。外したら終了。' : '挑戦は1回だけ。';
    const step = n => {
      $('#cd').textContent = n || 'GO'; beep(n ? 440 : 880);
      later(() => n ? step(n - 1) : launch(), n ? 750 : 450);
    };
    step(3);
  }

  function launch() { S.live = true; S.g0 = performance.now(); round(); }

  function round() {
    S.target = S.mode !== 'oneshot' ? 2 + Math.floor(Math.random() * 11) / 2 : 2 + Math.floor(Math.random() * 17) / 2;
    S.phase = 'idle';
    $('#tgt').textContent = S.target.toFixed(1);
    $('#tap').textContent = 'START'; $('#tap').classList.remove('run');
    $('#hint').textContent = S.mode === 'survival' ? `ROUND ${S.cleared + 1} ／ 許容誤差 ±${f2(tolOf(S.cleared))}秒` : 'START を押して、目標の秒数を数える';
    hud(); show('play');
  }

  function hud() {
    if (S.mode === 'survival') {
      $('#hS').textContent = `CLEAR ${S.cleared}`;
      $('#hC').textContent = `±${f2(tolOf(S.cleared))}秒`;
      return;
    }
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
    if (S.mode === 'survival') return judgeSurv(el, err);
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

  function judgeSurv(el, err) {
    const tol = tolOf(S.cleared), pass = err <= tol;
    const g = GR.find(x => err <= x[0]) || [0, 'GOOD', 0];
    const name = pass ? g[1] : 'OUT';
    S.rounds.push({ err, name, pts: pass ? g[2] : 0 });
    if (pass) S.cleared++; else S.fail = true;
    $('#gr').textContent = name; $('#gr').className = name;
    $('#er').textContent = (el >= S.target * 1000 ? '+' : '-') + f2(err);
    $('#pt').textContent = `実測 ${f2(el)}秒 / 目標 ${S.target.toFixed(1)}秒　許容 ±${f2(tol)}秒　` + (pass ? `CLEAR ${S.cleared}` : 'GAME OVER');
    beep(pass ? 880 : 200, .12);
    hud(); show('judge');
    later(() => S.fail ? end() : round(), pass ? 1000 : 1600);
  }

  function titleOf(mode, score, errMs) {
    if (mode === 'survival') return score < 5 ? 'SLEEPWALKER' : score < 10 ? 'TICK TOCK' : score < 20 ? 'CLOCKWORK' : score < 30 ? 'TIME MASTER' : 'TIME LORD';
    if (mode === 'attack') return score < 150 ? 'SLEEPWALKER' : score < 400 ? 'TICK TOCK' : score < 700 ? 'CLOCKWORK' : score < 1000 ? 'TIME MASTER' : 'TIME LORD';
    return errMs <= 50 ? 'TIME LORD' : errMs <= 150 ? 'TIME MASTER' : errMs <= 300 ? 'CLOCKWORK' : errMs <= 500 ? 'TICK TOCK' : 'SLEEPWALKER';
  }

  function end() {
    S.live = false; S.phase = 'locked';
    const rs = S.rounds, n = rs.length;
    const avg = n ? rs.reduce((a, r) => a + r.err, 0) / n : null;
    const bestErr = n ? Math.min(...rs.map(r => r.err)) : null;
    const perfects = rs.filter(r => r.name === 'PERFECT').length;
    const score = S.mode === 'attack' ? S.score : S.mode === 'survival' ? S.cleared : (n ? rs[0].pts : 0);
    let nb = false;
    R.plays++; R.perfects += perfects;
    if (S.mode === 'attack') { if (score > R.best) { R.best = score; nb = score > 0; } }
    else if (S.mode === 'survival') { if (score > R.surv) { R.surv = score; nb = true; } }
    else if (bestErr != null && (R.minErr == null || bestErr < R.minErr)) { R.minErr = bestErr; nb = true; }
    save();
    const title = titleOf(S.mode, score, bestErr == null ? 9999 : bestErr);
    const bestTxt = S.mode === 'attack' ? fmt(R.best) : S.mode === 'survival' ? R.surv + '連続' : (R.minErr == null ? '-' : f2(R.minErr) + '秒差');
    const stats = [['自己ベスト', bestTxt], ['PERFECT', perfects + '回'], ['平均誤差', avg == null ? '-' : f2(avg) + '秒']];
    const big = S.mode === 'attack' ? fmt(score) : S.mode === 'survival' ? String(score) : (bestErr == null ? '-' : f2(bestErr));
    const bigLabel = S.mode === 'attack' ? 'SCORE' : S.mode === 'survival' ? 'CLEAR' : '秒差';
    S.share = {
      big, bigLabel, title, stats,
      text: S.mode === 'survival'
        ? `ONE MORE SECOND【SURVIVAL】に挑戦！\n\nCLEAR：${score}連続\nTITLE：${title}\n最小誤差：${bestErr == null ? '-' : f2(bestErr)}秒差\n\nあなたは何連続いける？\n\n#ONEMORESECOND`
        : `ONE MORE SECONDに挑戦！\n\nSCORE：${fmt(score)}\nTITLE：${title}\nBEST：${bestErr == null ? '-' : f2(bestErr)}秒差\n\nあなたは何秒差を出せる？\n\n#ONEMORESECOND`
    };
    $('#rNew').textContent = nb ? 'NEW BEST' : title;
    $('#rBig').textContent = big; $('#rLbl').textContent = bigLabel;
    $('#rGrid').innerHTML = [...stats, ['称号', title]].map(([l, v]) => `<div class="cell"><span>${l}</span><b>${v}</b></div>`).join('');
    show('result');
  }

  // ---- display loop (rAF is for display only; timing uses performance.now) ----
  function loop() {
    if (S.live && S.mode === 'attack') {
      const el = performance.now() - S.g0, left = Math.max(0, LIMIT - el);
      $('#bar').style.transform = `scaleX(${left / LIMIT})`;
      if (el >= LIMIT) { if (S.phase === 'locked') S.over = true; else end(); }  // 未完了の問題は無効
    }
    requestAnimationFrame(loop);
  }

  // ---- input ----
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, unlock, { passive: true }));
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.go) show(b.dataset.go);
    else if (b.dataset.start) begin(b.dataset.start);
    else if (b.dataset.retry) begin(S.mode);
    else if (b.id === 'xBtn' && S.share) window.open(OMS_Share.xIntent(S.share.text), '_blank', 'noopener');
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
