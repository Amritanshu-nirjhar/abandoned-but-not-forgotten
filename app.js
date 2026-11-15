// Signal console. Content comes from data.js (SIGNALS, SOURCES, marsLightSeconds, MOON_LIGHT_S).
const $ = s => document.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOL = 1.4;   // how close (in channels) the dial must be to catch a carrier
const PAD = 22;    // half the 44px dial thumb: the thumb's centre travels PAD … width−PAD

const dial = $('#dial'), rx = $('#rx'), stateEl = $('#state'), count = $('#count'), cv = $('#scope'), g = cv.getContext('2d');
const found = new Set();
let target, locked = null, timers = [], noiseAmp = 1, touched = false;

const later = (fn, ms) => timers.push(setTimeout(fn, ms));
const every = (fn, ms) => timers.push(setInterval(fn, ms));
const cancel = () => { timers.forEach(clearTimeout); timers = []; }; // timeouts and intervals share one id pool
const say = t => { stateEl.textContent = t; };
const chLabel = v => 'CH ' + v.toFixed(1).padStart(5, '0');
const fmt = s => s < 60 ? s.toFixed(2) + ' s' : Math.floor(s / 60) + ' min ' + String(Math.floor(s % 60)).padStart(2, '0') + ' s';
const yearsSince = iso => (Date.now() - Date.parse(iso)) / 31557600000;

// ── Sound: off until asked. Static, a soft click on lock, one clean ping for the return. ──
let ac, noiseGain, noiseLevel = 0.05;
function setNoise(v) { noiseLevel = v; if (noiseGain) noiseGain.gain.setTargetAtTime(v, ac.currentTime, 0.25); }
function blip(freq, dur) {
  if (!ac || ac.state !== 'running') return;
  const o = ac.createOscillator(), a = ac.createGain();
  o.frequency.value = freq;
  a.gain.setValueAtTime(0.12, ac.currentTime);
  a.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  o.connect(a).connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
}
$('#sound').onclick = e => {
  const b = e.currentTarget, on = b.getAttribute('aria-pressed') !== 'true';
  b.setAttribute('aria-pressed', on); b.textContent = on ? 'Sound on' : 'Sound off';
  if (!on) return ac.suspend();
  if (ac) return ac.resume();
  ac = new AudioContext();
  const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource(), lp = ac.createBiquadFilter();
  src.buffer = buf; src.loop = true; lp.frequency.value = 1400;
  noiseGain = ac.createGain(); noiseGain.gain.value = noiseLevel;
  src.connect(lp).connect(noiseGain).connect(ac.destination); src.start();
};

// ── Scope: noise floor with a peak per signal. Peak height = life. Lost objects have a tick and no peak. ──
function draw() {
  const w = cv.clientWidth, h = cv.clientHeight, d = Math.min(devicePixelRatio || 1, 2);
  if (!w) return;
  if (cv.width !== Math.round(w * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
  g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, h);
  const X = ch => PAD + ch / 100 * (w - 2 * PAD);
  // One marker per object along the bottom: hollow until found, filled amber after. The one under the needle is ringed.
  for (const s of SIGNALS) {
    g.beginPath(); g.arc(X(s.ch), h - 7, 3, 0, 7);
    found.has(s.id) ? (g.fillStyle = 'hsl(36 90% 64%)', g.fill()) : (g.strokeStyle = '#8f8b83', g.lineWidth = 1, g.stroke());
    if (s === target) { g.beginPath(); g.arc(X(s.ch), h - 7, 7, 0, 7); g.strokeStyle = '#f4f0e7'; g.lineWidth = 1; g.stroke(); }
  }
  if (!touched) { // until the needle is first moved, say what it is
    const x = X(+dial.value) + 26, a = reduce ? 1 : 0.6 + 0.4 * Math.sin(performance.now() / 300);
    g.font = '500 12px "DM Mono", monospace'; g.fillStyle = `hsl(36 90% 64% / ${a})`; g.fillText('DRAG ME ▸', x, 24);
  }
  g.beginPath();
  for (let x = 0; x <= w; x += 3) {
    let y = Math.random() * 9 * noiseAmp;
    for (const s of SIGNALS) {
      const dx = (x - X(s.ch)) / 6;
      if (dx > -4 && dx < 4) y += s.life * (h - 62) * Math.exp(-dx * dx) * (1 - Math.random() * 0.3 * (1 - s.life));
    }
    g.lineTo(x, h - 16 - y);
  }
  g.strokeStyle = 'hsl(36 50% 64% / .75)'; g.lineWidth = 1; g.stroke();
}
let lastFrame = 0;
function loop(t) { if (t - lastFrame > 70) { lastFrame = t; draw(); } requestAnimationFrame(loop); }
addEventListener('resize', draw);
if (!reduce) addEventListener('scroll', () => document.documentElement.style.setProperty('--sy', scrollY), { passive: true }); // star parallax

// ── Tuning ──
function tune() {
  const v = +dial.value;
  $('#ch').textContent = chLabel(v);
  dial.setAttribute('aria-valuetext', chLabel(v));
  const near = SIGNALS.find(s => Math.abs(s.ch - v) < TOL) || null;
  if (near === target) return;
  target = near; locked = null; cancel(); count.textContent = '';
  rx.replaceChildren(); rx.className = '';
  noiseAmp = 1; updateLog();
  if (!near) { say(found.size ? 'Static. No carrier.' : 'Static. Drag the needle onto a spike, or press Next signal.'); setNoise(0.05); }
  else {
    say(found.has(near.id) ? `Carrier: ${near.title}. Hold.` : 'Carrier detected. Hold.');
    setNoise(0.035);
    // The live one answers at once, even mid-sweep. Everything else needs the dial to rest.
    later(() => acquire(near), near.state === 'alive' ? 0 : 400);
  }
  if (reduce) draw();
}

function acquire(s) {
  if (s.state === 'alive') return lock(s);
  const mars = s.world === 'Mars';
  const real = mars ? marsLightSeconds(Date.now()) : MOON_LIGHT_S;
  const wait = mars ? 4000 + real / 60 * 200 : real * 1000; // Moon delay is actual; Mars is compressed
  const t0 = performance.now();
  say(`Acquiring. One-way light delay from ${s.world === 'Mars' ? 'Mars today' : 'the Moon'}: ${fmt(real)}${mars ? ', compressed here to ' + (wait / 1000).toFixed(0) + ' seconds' : ', actual'}.`);
  every(() => { count.textContent = 'T−' + fmt(real * Math.max(0, 1 - (performance.now() - t0) / wait)); }, 100);
  later(() => lock(s), wait);
}

const VERDICT = {
  alive: () => 'Locked. Clean return. This one answers.',
  inert: () => 'Locked. A passive object: it never transmitted. Archive record follows.',
  dead: s => `No carrier. ${s.status.split(' · ')[0]}. Replaying the archive record.`,
  lost: () => 'No carrier. Nothing was ever received from the surface. Archive record follows.',
};

function lock(s) {
  cancel(); count.textContent = '';
  locked = s; found.add(s.id);
  const alive = s.state === 'alive';
  noiseAmp = alive ? 0.08 : 1; setNoise(alive ? 0 : 0.012); blip(170, 0.06);
  say(VERDICT[s.state](s));
  rx.className = s.state;
  rx.style.setProperty('--life', s.life);
  rx.innerHTML = `
    <header>
      <p class="kicker mono">${CHAPTERS.find(c => c.id === s.chapter).title} · ${s.world} · ${chLabel(s.ch)}</p>
      <h2>${s.title}</h2>
    </header>
    <figure>
      ${s.img ? `<img src="${s.img}" alt="${s.alt}" loading="lazy" onerror="this.closest('figure').remove()">
      <figcaption class="mono">${s.credit}</figcaption>` : '<p class="noimg mono">No photograph shown.</p>'}
    </figure>
    <div class="body">
      <dl class="mono">
        <dt>Location</dt><dd>${s.place}</dd>
        <dt>Coordinates</dt><dd>${s.coords}</dd>
        <dt>Mass</dt><dd>${s.mass}</dd>
        <dt>${s.state === 'dead' ? 'Last heard' : 'Left'}</dt><dd>${new Date(s.left).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })} · ${yearsSince(s.left).toFixed(1)} years ago</dd>
      </dl>
      ${s.last ? `<p class="last mono">${s.last}</p>` : ''}
      <p class="sr-only">${s.narrative}</p>
      <p class="narr" aria-hidden="true"></p>
      <p class="status mono"><span class="dot"></span>${s.status}</p>
      <p class="links mono">${s.model ? `<a href="models.html#${s.model}">See it in 3D ▸</a>` : ''}<a href="#map" data-pin="${s.id}">Show on the map ▸</a></p>
      ${alive ? `
      <div class="live">
        <p class="mono">Farther from Earth than on the day they were placed</p>
        <span id="drift" aria-hidden="true"></span>
        <p class="sr-only">About ${(yearsSince(s.left) * 0.038).toFixed(2)} metres, growing by 3.8 centimetres a year.</p>
        <button id="fire" class="mono">Fire laser</button>
        <div class="beam"></div>
        <p id="return" class="mono" role="status"></p>
      </div>` : ''}
    </div>`;
  decode(rx.querySelector('.narr'), s.narrative, { alive: Infinity, inert: 5, dead: 2.5, lost: 1.5 }[s.state]);
  if (alive) live(s);
  updateLog();
  history.replaceState(null, '', '#' + s.id);
  if (reduce) draw();
}

// Text resolves out of noise; the deader the source, the slower. The live one arrives whole.
function decode(el, text, perTick) {
  if (reduce || perTick === Infinity) { el.textContent = text; return; }
  const G = '░▒▓/|-_=+·:';
  let i = 0;
  every(() => {
    i = Math.min(text.length, i + perTick);
    let tail = '';
    for (let n = Math.min(10, text.length - Math.floor(i)); n > 0; n--) tail += G[Math.random() * G.length | 0];
    el.textContent = text.slice(0, Math.floor(i)) + tail;
  }, 40);
  later(() => { el.textContent = text; }, text.length / perTick * 40 + 80);
}

function live(s) {
  const drift = $('#drift'), fire = $('#fire'), ret = $('#return');
  const tick = () => { drift.textContent = (yearsSince(s.left) * 0.038).toFixed(9) + ' m'; };
  tick(); every(tick, reduce ? 1000 : 100);
  fire.onclick = () => {
    if (fire.getAttribute('aria-disabled') === 'true') return;
    fire.setAttribute('aria-disabled', 'true');
    ret.textContent = 'Pulse sent. Waiting for light.';
    rx.classList.add('firing'); blip(170, 0.06);
    later(() => {
      fire.removeAttribute('aria-disabled'); rx.classList.remove('firing');
      ret.textContent = `Return received after ${(MOON_LIGHT_S * 2).toFixed(3)} s. That delay was not simulated: it is how long light takes to reach the Moon and come back.`;
      blip(1320, 1.6);
    }, MOON_LIGHT_S * 2000);
  };
}

// ── Chapters under the dial ──
$('#chapters').append(...CHAPTERS.map(c => { const el = document.createElement('span'); el.textContent = c.title; el.style.flexGrow = SIGNALS.filter(s => s.chapter === c.id).length; return el; }));

// ── Map: a pin per object on a flat map of each world. Pins that share a spot fan out around it. ──
const pins = [];
for (const world of ['Moon', 'Mars']) {
  const fig = document.createElement('figure'), box = document.createElement('div'), img = new Image(), here = SIGNALS.filter(s => s.world === world), seen = {};
  img.alt = `Map of ${world}`; img.loading = 'lazy'; img.src = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(MAPS[world])}?width=1280`;
  box.className = 'mapbox'; box.append(img);
  for (const s of here) {
    const key = Math.round(s.lat / 3) + ',' + Math.round(s.lon / 3), n = seen[key] = (seen[key] || 0) + 1, a = n * 2.4, r = n > 1 ? 9 + n * 2.5 : 0; // the nth pin at a spot steps out along a spiral
    const p = document.createElement('button'); p.className = 'mpin ' + s.state; p.style.cssText = `left:${(s.lon + 180) / 3.6}%;top:${(90 - s.lat) / 1.8}%;--dx:${(Math.cos(a) * r).toFixed(1)}px;--dy:${(Math.sin(a) * r).toFixed(1)}px;--life:${s.life}`;
    p.setAttribute('aria-label', `${s.title}, ${s.place}`); p.innerHTML = '<span></span>'; p.firstChild.textContent = s.title;
    p.onclick = () => goto(s.ch, true); box.append(p); pins.push([s, p]);
  }
  const cap = document.createElement('figcaption'); cap.className = 'mono'; cap.textContent = `${world} · ${here.length} objects`;
  fig.append(box, cap); $('.maps').append(fig);
}
rx.addEventListener('click', ev => { const id = ev.target.dataset && ev.target.dataset.pin; if (id) { const p = pins.find(([s]) => s.id === id)[1]; setTimeout(() => p.focus({ preventScroll: true }), 50); } });

// ── Log: the non-audio, non-drag way in. Built once so keyboard focus survives updates. ──
const logRows = SIGNALS.map((s, i) => {
  if (!i || SIGNALS[i - 1].chapter !== s.chapter) { // a heading where each chapter starts
    const c = CHAPTERS.find(c => c.id === s.chapter), head = document.createElement('li'); head.className = 'chap';
    head.innerHTML = `<h3></h3><p class="mono"></p>`; head.firstChild.textContent = c.title; head.lastChild.textContent = c.blurb; $('#log ol').append(head);
  }
  const li = document.createElement('li'), b = document.createElement('button');
  b.innerHTML = '<span class="th"></span><span class="mono ch"></span><span class="t"></span><span class="mono st"></span>';
  b.querySelector('.ch').textContent = chLabel(s.ch);
  b.onclick = () => goto(s.ch, true);
  li.append(b); $('#log ol').append(li);
  return [s, b];
});
function updateLog() {
  for (const [s, b] of logRows) {
    const f = found.has(s.id);
    b.classList.toggle('found', f);
    b.style.setProperty('--life', f ? s.life : 0);
    b.querySelector('.t').textContent = f ? s.title : 'Unidentified carrier';
    b.querySelector('.st').textContent = f ? s.status : 'Not yet heard';
    const th = b.querySelector('.th'); if (f && s.img && !th.firstChild) { const im = new Image(); im.alt = ''; im.loading = 'lazy'; im.onerror = () => im.remove(); im.src = s.img; th.append(im); }
    locked === s ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current');
  }
  for (const [s, p] of pins) { p.classList.toggle('found', found.has(s.id)); p.classList.toggle('on', locked === s); }
  $('#tally').textContent = $('#got').textContent = `${found.size} of ${SIGNALS.length} logged`;
  $('#coda').hidden = found.size < SIGNALS.length;
}
function goto(ch, scroll) {
  dial.value = ch; tune();
  if (scroll) $('#console').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
}
dial.addEventListener('input', () => { touched = true; tune(); });
$('#next').onclick = () => { touched = true; const s = SIGNALS.find(s => s.ch > +dial.value + TOL); if (s) goto(s.ch); };
$('#prev').onclick = () => { const s = SIGNALS.findLast(s => s.ch < +dial.value - TOL); if (s) goto(s.ch); };

// ── Scale: one square per tonne ──
{
  const nf = n => n.toLocaleString('en-GB'), moonT = Math.round(SCALE.moonKg / 1000), sivbT = Math.round(moonT * SCALE.sivbShare), marsT = Math.round(SCALE.marsKg / 1000);
  $('#kg').textContent = nf(SCALE.moonKg); $('#nMoon').textContent = SCALE.moonObjects; $('#marsKg').textContent = nf(SCALE.marsKg); $('#nHere').textContent = SIGNALS.length;
  const sq = (n, cls) => Array.from({ length: n }, () => Object.assign(document.createElement('i'), { className: cls }));
  $('#tonnes').append(...sq(sivbT, 'a'), ...sq(moonT - sivbT, ''), ...sq(1, 'gap'), ...sq(marsT, 'm'));
  $('#tonnes').setAttribute('aria-label', `${moonT} squares for the Moon, ${sivbT} of them highlighted for the five rocket stages, and ${marsT} squares for Mars.`);
}

// ── About ──
$('#about-open').onclick = () => $('#about').showModal();
const linkList = (ul, items) => items.forEach(([label, url]) => {
  const li = document.createElement('li'), a = document.createElement('a');
  a.href = url; a.textContent = label; a.target = '_blank'; a.rel = 'noopener';
  li.append(a); ul.append(li);
});
linkList($('#sources'), SOURCES.map(s => [s.label, s.url]));
linkList($('#credits'), SIGNALS.filter(s => s.img).map(s => [`${s.title}: ${s.credit}`, s.src]));

// ── Boot: a cursor, four lines, then the band. Any key or tap skips it. ──
const N = SIGNALS.length, STOPPED = SIGNALS.filter(s => s.state === 'dead').length;
const BOOT = `> ${N} objects. two worlds.\n> most of them never transmitted. ${STOPPED} of them stopped.\n> one still answers.\n> drag the needle to find them.\n`;
$('#coda').textContent = `All ${N} logged. ${N - 1} will not answer again. One will, for as long as anyone points a light at it.`;
dial.setAttribute('aria-label', `Tuning dial. ${N} signals between channel 0 and 100.`);
let started = false;
function start() {
  if (started) return; started = true;
  $('#bootline').textContent = BOOT;
  $('#console').hidden = false;
  draw(); if (!reduce) requestAnimationFrame(loop);
  const s = SIGNALS.find(s => s.id === location.hash.slice(1));
  s ? goto(s.ch) : tune();
}
if (reduce || location.hash) start();
else {
  let i = 0;
  const iv = setInterval(() => {
    $('#bootline').textContent = BOOT.slice(0, ++i);
    if (i >= BOOT.length) { clearInterval(iv); setTimeout(start, 500); }
  }, 28);
  const skip = () => { clearInterval(iv); start(); };
  addEventListener('pointerdown', skip, { once: true });
  addEventListener('keydown', skip, { once: true });
}
