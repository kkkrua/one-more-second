(() => {
  'use strict';
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const KEY = 'oms_v2', LIMIT = 45000;
  const GR = [[50, 'PERFECT', 100], [150, 'INSANE', 80], [300, 'GREAT', 60], [500, 'GOOD', 40], [800, 'NICE', 20]];
  const ENEMIES = [
    { name: 'SLIME', jp: 'スライム', hp: 120, glyph: '●', type: 'ENEMY 01 / 06' },
    { name: 'SHADOW', jp: 'シャドウ', hp: 150, glyph: '◈', type: 'ENEMY 02 / 06' },
    { name: 'GOLEM', jp: 'ゴーレム', hp: 190, glyph: '⬟', type: 'ENEMY 03 / 06' },
    { name: 'PHANTOM', jp: 'ファントム', hp: 180, glyph: '◉', type: 'ENEMY 04 / 06' },
    { name: 'KNIGHT', jp: 'ナイト', hp: 220, glyph: '✦', type: 'ENEMY 05 / 06' },
    { name: 'TIME EATER', jp: '時間を喰らう者', hp: 600, glyph: '◉', type: 'FINAL BOSS' }
  ];
  const fmt = n => n.toLocaleString('en-US'), f2 = ms => (ms / 1000).toFixed(2);
  const tolOf = n => Math.max(50, Math.round(800 * Math.pow(0.93, n)));
  const mult = c => c >= 8 ? 3 : c >= 5 ? 2 : c >= 3 ? 1.5 : 1;

  function load() {
    const z = { best: 0, surv: 0, minErr: null, plays: 0, perfects: 0, stageWins: 0, bestStageDamage: 0 };
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (!d || typeof d !== 'object') return z;
      return { ...z, ...d };
    } catch (e) { return z; }
  }
  let R = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(R)); } catch (e) {} };

  let timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const clr = () => { timers.forEach(clearTimeout); timers = []; };
  let ac;
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
      g.gain.exponentialRampToValueAtTime(.05, t + .01);
      g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g); g.connect(ac.destination);
      o.start(t); o.stop(t + d + .02);
    } catch (e) {}
  }

  let S = {};
  function show(n) {
    clr(); S.screen = n;
    $$('.screen').forEach(s => s.classList.toggle('on', s.id === n));
    const active = S.live && ['attack', 'survival', 'stage'].includes(S.mode) && (n === 'play' || n === 'judge');
    document.body.classList.toggle('live', !!active);
    document.body.classList.toggle('surv', S.mode === 'survival');
    document.body.classList.toggle('stage', S.mode === 'stage' && (n === 'play' || n === 'judge'));
    if (n === 'title') {
      $('#rec').innerHTML = `STAGE BEST　${fmt(R.bestStageDamage)} DMG / CLEAR ${R.stageWins}<br>SCORE ATTACK　${fmt(R.best)}<br>SURVIVAL　${R.surv}連続<br>ONE SHOT　${R.minErr == null ? '-' : f2(R.minErr) + '秒'}<br>プレイ ${R.plays}回　PERFECT ${R.perfects}回`;
    }
  }

  function begin(mode) {
    S = {
      screen: 'ready', live: false, phase: 'idle', mode, rounds: [], score: 0, combo: 0,
      over: false, cleared: 0, fail: false, enemyIndex: 0, enemyHp: 0, totalDamage: 0,
      stageStart: 0, maxCombo: 0, perfects: 0
    };
    if (mode === 'stage') S.enemyHp = ENEMIES[0].hp;
    show('ready');
    $('#cdt').textContent = mode === 'stage'
      ? '敵5体を倒し、最後のボスを撃破しろ。'
      : mode === 'attack' ? '45秒。目標の秒数を心の中で数える。'
      : mode === 'survival' ? '許容誤差は少しずつ狭くなる。外したら終了。'
      : '挑戦は1回だけ。';
    const step = n => {
      $('#cd').textContent = n || 'GO'; beep(n ? 440 : 880);
      later(() => n ? step(n - 1) : launch(), n ? 750 : 450);
    };
    step(3);
  }

  function launch() {
    S.live = true; S.g0 = performance.now();
    if (S.mode === 'stage') S.stageStart = S.g0;
    round();
  }

  function renderEnemy() {
    const e = ENEMIES[S.enemyIndex];
    $('#enemyType').textContent = e.type;
    $('#enemyName').textContent = e.name;
    $('#enemyHp').textContent = `HP ${Math.max(0, S.enemyHp)} / ${e.hp}`;
    $('#enemyHpFill').style.width = `${Math.max(0, S.enemyHp) / e.hp * 100}%`;
    $('#enemyGlyph').textContent = e.glyph;
    $('#battleMeta').textContent = `${S.enemyIndex + 1} / 6　${e.jp}`;
    $('#enemyArt').classList.toggle('boss-art', S.enemyIndex === 5);
  }

  function round() {
    S.target = S.mode === 'oneshot'
      ? 2 + Math.floor(Math.random() * 17) / 2
      : 2 + Math.floor(Math.random() * 11) / 2;
    S.phase = 'idle';
    $('#tgt').textContent = S.target.toFixed(1);
    $('#tap').textContent = 'START'; $('#tap').classList.remove('run');
    if (S.mode === 'stage') {
      $('#battlePanel').style.display = 'block';
      renderEnemy();
      $('#hint').textContent = 'STARTを押して時間を数え、攻撃する。';
    } else {
      $('#battlePanel').style.display = 'none';
      $('#hint').textContent = S.mode === 'survival'
        ? `ROUND ${S.cleared + 1} ／ 許容誤差 ±${f2(tolOf(S.cleared))}秒`
        : 'START を押して、目標の秒数を数える';
    }
    hud(); show('play');
  }

  function hud() {
    if (S.mode === 'survival') {
      $('#hS').textContent = `CLEAR ${S.cleared}`;
      $('#hC').textContent = `±${f2(tolOf(S.cleared))}秒`;
    } else if (S.mode === 'stage') {
      $('#hS').textContent = `DMG ${fmt(S.totalDamage)}`;
      $('#hC').textContent = S.combo ? `COMBO ${S.combo} ×${mult(S.combo)}` : `ENEMY ${S.enemyIndex + 1}/6`;
    } else {
      $('#hS').textContent = fmt(S.score);
      $('#hC').textContent = S.combo ? `COMBO ${S.combo} ×${mult(S.combo)}` : '';
    }
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
      if (t - S.t0 < 150) return;
      S.phase = 'locked';
      judge(t - S.t0);
    }
  }

  function gradeFor(err) { return GR.find(x => err <= x[0]) || [0, 'MISS', 0]; }

  function judge(el) {
    const err = Math.abs(el - S.target * 1000);
    if (S.mode === 'survival') return judgeSurv(el, err);
    const g = gradeFor(err);
    S.combo = g[2] > 0 ? S.combo + 1 : 0;
    S.maxCombo = Math.max(S.maxCombo, S.combo);
    if (g[1] === 'PERFECT') S.perfects++;
    if (S.mode === 'stage') return judgeStage(el, err, g);
    const gained = Math.round(g[2] * (g[2] > 0 ? mult(S.combo) : 1));
    S.score += gained;
    S.rounds.push({ err, name: g[1], pts: g[2] });
    $('#gr').textContent = g[1]; $('#gr').className = g[1];
    $('#er').textContent = (el >= S.target * 1000 ? '+' : '-') + f2(err);
    $('#pt').textContent = `実測 ${f2(el)}秒 / 目標 ${S.target.toFixed(1)}秒　+${gained}点`;
    beep(g[2] ? 880 : 200, .12);
    hud(); show('judge');
    later(() => (S.mode === 'oneshot' || S.over) ? end() : round(), S.mode === 'attack' ? 1100 : 1500);
  }

  function judgeStage(el, err, g) {
    const base = g[2];
    const multiplier = base > 0 ? mult(S.combo) : 1;
    const damage = Math.round(base * multiplier);
    const enemy = ENEMIES[S.enemyIndex];
    S.enemyHp = Math.max(0, S.enemyHp - damage);
    S.totalDamage += damage;
    S.rounds.push({ err, name: g[1], pts: damage, enemy: enemy.name });
    if (S.enemyHp === 0) S.cleared++;
    $('#gr').textContent = g[1]; $('#gr').className = g[1];
    $('#er').textContent = (el >= S.target * 1000 ? '+' : '-') + f2(err);
    const defeated = S.enemyHp === 0;
    $('#pt').textContent = `実測 ${f2(el)}秒 / 目標 ${S.target.toFixed(1)}秒\n${damage ? `DAMAGE ${damage}（×${multiplier}）` : 'DAMAGE 0'}${defeated ? '　ENEMY DEFEATED!' : `　残りHP ${S.enemyHp}`}`;
    beep(damage ? (g[1] === 'PERFECT' ? 1040 : 880) : 200, .12);
    hud(); show('judge');
    later(() => {
      if (defeated) {
        if (S.enemyIndex === ENEMIES.length - 1) end(true);
        else {
          S.enemyIndex++;
          S.enemyHp = ENEMIES[S.enemyIndex].hp;
          round();
        }
      } else round();
    }, defeated ? 1350 : 1050);
  }

  function judgeSurv(el, err) {
    const tol = tolOf(S.cleared), pass = err <= tol;
    const g = gradeFor(err);
    const name = pass ? g[1] : 'OUT';
    S.rounds.push({ err, name, pts: pass ? g[2] : 0 });
    if (pass) S.cleared++; else S.fail = true;
    $('#gr').textContent = name; $('#gr').className = name;
    $('#er').textContent = (el >= S.target * 1000 ? '+' : '-') + f2(err);
    $('#pt').textContent = `実測 ${f2(el)}秒 / 目標 ${S.target.toFixed(1)}秒　許容 ±${f2(tol)}秒　${pass ? `CLEAR ${S.cleared}` : 'GAME OVER'}`;
    beep(pass ? 880 : 200, .12);
    hud(); show('judge');
    later(() => S.fail ? end() : round(), pass ? 1000 : 1600);
  }

  function titleOf(mode, score, errMs) {
    if (mode === 'survival') return score < 5 ? 'SLEEPWALKER' : score < 10 ? 'TICK TOCK' : score < 20 ? 'CLOCKWORK' : score < 30 ? 'TIME MASTER' : 'TIME LORD';
    if (mode === 'stage') return score >= 1800 ? 'TIME LORD' : score >= 1200 ? 'TIME MASTER' : score >= 700 ? 'CLOCKWORK' : 'TICK TOCK';
    if (mode === 'attack') return score < 150 ? 'SLEEPWALKER' : score < 400 ? 'TICK TOCK' : score < 700 ? 'CLOCKWORK' : score < 1000 ? 'TIME MASTER' : 'TIME LORD';
    return errMs <= 50 ? 'TIME LORD' : errMs <= 150 ? 'TIME MASTER' : errMs <= 300 ? 'CLOCKWORK' : errMs <= 500 ? 'TICK TOCK' : 'SLEEPWALKER';
  }

  function end(stageWon = false) {
    S.live = false; S.phase = 'locked';
    const rs = S.rounds, n = rs.length;
    const avg = n ? rs.reduce((a, r) => a + r.err, 0) / n : null;
    const bestErr = n ? Math.min(...rs.map(r => r.err)) : null;
    const perfects = rs.filter(r => r.name === 'PERFECT').length;
    const score = S.mode === 'attack' ? S.score : S.mode === 'survival' ? S.cleared : S.mode === 'stage' ? S.totalDamage : (n ? rs[0].pts : 0);
    let nb = false;
    R.plays++; R.perfects += perfects;
    if (S.mode === 'attack') { if (score > R.best) { R.best = score; nb = score > 0; } }
    else if (S.mode === 'survival') { if (score > R.surv) { R.surv = score; nb = true; } }
    else if (S.mode === 'stage') {
      if (stageWon) R.stageWins++;
      if (score > R.bestStageDamage) { R.bestStageDamage = score; nb = true; }
    } else if (bestErr != null && (R.minErr == null || bestErr < R.minErr)) { R.minErr = bestErr; nb = true; }
    save();
    const title = titleOf(S.mode, score, bestErr == null ? 9999 : bestErr);
    const stageDuration = S.mode === 'stage' ? f2(performance.now() - S.stageStart) + '秒' : null;
    const stats = S.mode === 'stage'
      ? [['撃破', `${S.cleared}/6体`], ['PERFECT', `${perfects}回`], ['最大コンボ', `${S.maxCombo}`], ['クリアタイム', stageDuration]]
      : [['自己ベスト', S.mode === 'attack' ? fmt(R.best) : S.mode === 'survival' ? R.surv + '連続' : (R.minErr == null ? '-' : f2(R.minErr) + '秒差')], ['PERFECT', perfects + '回'], ['平均誤差', avg == null ? '-' : f2(avg) + '秒']];
    const big = S.mode === 'stage' ? (stageWon ? 'CLEAR' : 'FAILED') : S.mode === 'attack' ? fmt(score) : S.mode === 'survival' ? String(score) : (bestErr == null ? '-' : f2(bestErr));
    const bigLabel = S.mode === 'stage' ? `TOTAL DAMAGE ${fmt(score)}` : S.mode === 'attack' ? 'SCORE' : S.mode === 'survival' ? 'CLEAR' : '秒差';
    const shareText = S.mode === 'stage'
      ? `ONE MORE SECOND【STAGE BATTLE】\n${stageWon ? 'BOSS DEFEATED!' : 'BATTLE OVER'}\n総ダメージ：${fmt(score)}\n撃破：${S.cleared}/6体\nPERFECT：${perfects}回\n最大コンボ：${S.maxCombo}\n\n#ONEMORESECOND`
      : S.mode === 'survival'
        ? `ONE MORE SECOND【SURVIVAL】に挑戦！\nCLEAR：${score}連続\nTITLE：${title}\n\n#ONEMORESECOND`
        : `ONE MORE SECONDに挑戦！\nSCORE：${fmt(score)}\nTITLE：${title}\n\n#ONEMORESECOND`;
    S.share = { big, bigLabel, title: S.mode === 'stage' ? (stageWon ? 'BOSS DEFEATED' : 'BATTLE OVER') : title, stats: stats.slice(0, 3), text: shareText };
    $('#rNew').textContent = nb ? 'NEW BEST' : (S.mode === 'stage' ? (stageWon ? 'STAGE CLEAR' : 'KEEP TRYING') : title);
    $('#rBig').textContent = big; $('#rLbl').textContent = bigLabel;
    $('#rGrid').innerHTML = [...stats, ['称号', title]].map(([l, v]) => `<div class="cell"><span>${l}</span><b>${v}</b></div>`).join('');
    show('result');
  }

  function loop() {
    if (S.live && S.mode === 'attack') {
      const el = performance.now() - S.g0, left = Math.max(0, LIMIT - el);
      $('#bar').style.transform = `scaleX(${left / LIMIT})`;
      if (el >= LIMIT) { if (S.phase === 'locked') S.over = true; else end(); }
    }
    requestAnimationFrame(loop);
  }

  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, unlock, { passive: true }));
  document.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.go) show(b.dataset.go);
    else if (b.dataset.start) begin(b.dataset.start);
    else if (b.dataset.retry) begin(S.mode);
    else if (b.id === 'xBtn' && S.share) {
      b.disabled = true;
      try { await OMS_Share.share(S.share); }
      catch (err) { window.open(OMS_Share.xIntent(S.share.text), '_blank', 'noopener'); }
      b.disabled = false;
    }
    b.blur();
  });
  $('#play').addEventListener('pointerdown', e => { e.preventDefault(); act(); });
  document.addEventListener('keydown', e => {
    if (e.code !== 'Space') return;
    e.preventDefault(); if (e.repeat) return;
    if (S.screen === 'play') act(); else if (S.screen === 'title') show('mode');
  });
  document.addEventListener('keyup', e => { if (e.code === 'Space') e.preventDefault(); });

  $('#battlePanel').style.display = 'none';
  show('title'); loop();
})();
