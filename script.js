const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const scoreEl = document.getElementById('score');
const msgEl = document.getElementById('msg');
const bestEl = document.getElementById('best');

const BASE = 5, H_BLOCK = 0.6, TOL = 0.2, RANGE = 6;
const SPEED_START = 3.2, SPEED_STEP = 0.1, SPEED_MAX = 7; // velocidade inicial, aumento por peça e limite
let W, H, sc, cam, camTarget;
let stack, mov, debris, fx, state, score, combo, speed, bgHue, hueTarget, best;

try { best = +localStorage.getItem('stackBest') || 0; } catch (e) { best = 0; }

let dprCap = 2;
function resize() {
  const d = Math.min(window.devicePixelRatio || 1, dprCap);
  W = innerWidth; H = innerHeight;
  cv.width = W * d; cv.height = H * d;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  sc = Math.max(10, Math.min(W, H) / 15);
}
addEventListener('resize', resize);
resize();

function hueOf(i) { return (190 + i * 7) % 360; }

function reset() {
  stack = [{ x: 0, z: 0, w: BASE, d: BASE, y: 0, h: H_BLOCK, hue: hueOf(0) }];
  debris = []; fx = [];
  score = 0; combo = 0; speed = SPEED_START;
  cam = camTarget = H_BLOCK;
  bgHue = hueTarget = hueOf(0);
  scoreEl.textContent = 0;
  spawn();
}

function spawn() {
  const t = stack[stack.length - 1];
  const axis = stack.length % 2 ? 'x' : 'z';
  mov = {
    x: t.x, z: t.z, w: t.w, d: t.d, y: t.y + t.h, h: H_BLOCK,
    hue: hueOf(stack.length), axis, dir: 1
  };
  mov[axis] = t[axis] - RANGE;
  hueTarget = hueOf(stack.length);
}

function place() {
  const t = stack[stack.length - 1];
  const a = mov.axis;
  const size = a === 'x' ? 'w' : 'd';
  const delta = mov[a] - t[a];
  const overlap = t[size] - Math.abs(delta);

  if (overlap <= 0) { gameOver(); return; }

  if (Math.abs(delta) < TOL) {
    mov[a] = t[a];
    combo++;
    fx.push({ x: mov.x, z: mov.z, w: mov.w, d: mov.d, y: mov.y + mov.h, t: 0 });
    if (combo >= 5) { // recompensa: bloco volta a crescer
      const grow = Math.min(0.3, BASE - mov[size]);
      mov[size] += grow; mov[a] -= grow / 2;
    }
  } else {
    combo = 0;
    const cut = { x: mov.x, z: mov.z, w: mov.w, d: mov.d, y: mov.y, h: mov.h, hue: mov.hue, vy: 0 };
    if (delta > 0) { cut[a] = t[a] + t[size]; } else { cut[a] = mov[a]; }
    cut[size] = Math.abs(delta);
    debris.push(cut);
    mov[size] = overlap;
    mov[a] = Math.max(mov[a], t[a]);
  }

  stack.push({ x: mov.x, z: mov.z, w: mov.w, d: mov.d, y: mov.y, h: mov.h, hue: mov.hue });
  score++;
  scoreEl.textContent = score;
  speed = Math.min(SPEED_START + score * SPEED_STEP, SPEED_MAX);
  camTarget = mov.y + mov.h;
  spawn();
}

function gameOver() {
  state = 'over';
  debris.push({ ...mov, vy: 0 });
  mov = null;
  if (score > best) {
    best = score;
    try { localStorage.setItem('stackBest', best); } catch (e) {}
  }
  bestEl.textContent = 'Recorde: ' + best;
  msgEl.querySelector('p').textContent = 'Fim de jogo — toque para reiniciar';
  msgEl.classList.remove('hide');
  overAt = performance.now();
}
let overAt = 0;

function input() {
  if (state === 'ready') {
    state = 'play';
    msgEl.classList.add('hide');
  } else if (state === 'play') {
    place();
  } else if (state === 'over' && performance.now() - overAt > 500) {
    reset();
    state = 'play';
    msgEl.classList.add('hide');
  }
}
addEventListener('pointerdown', e => { e.preventDefault(); input(); });
addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); input(); } });

/* ---------- Desenho isométrico ---------- */
function P(x, y, z) {
  return [W / 2 + (x - z) * 0.866 * sc, H * 0.58 + (x + z - 5) * 0.5 * sc - (y - cam) * sc];
}
function poly(fill, stroke, pts) {
  ctx.beginPath();
  pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1, sc * 0.045); ctx.lineJoin = 'round';
  ctx.stroke();
}
function colors(b) {
  if (!b.c) {
    const h = b.hue;
    b.c = {
      front: `hsl(${h},70%,16%)`, side: `hsl(${h},70%,10%)`, top: `hsl(${h},85%,30%)`,
      edge: `hsl(${h},100%,52%)`, edgeGlow: `hsl(${h},100%,68%)`, halo: `hsla(${h},100%,60%,0.2)`
    };
  }
  return b.c;
}
function box(b, glow) {
  const x0 = b.x, x1 = b.x + b.w, z0 = b.z, z1 = b.z + b.d, y0 = b.y, y1 = b.y + b.h;
  // fora da tela: não desenha
  if (P(x0, y1, z0)[1] > H + sc || P(x1, y0, z1)[1] < -sc) return;
  const c = colors(b), edge = glow ? c.edgeGlow : c.edge;
  poly(c.front, edge, [P(x0, y1, z1), P(x1, y1, z1), P(x1, y0, z1), P(x0, y0, z1)]);
  poly(c.side, edge, [P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1), P(x1, y0, z0)]);
  const top = [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)];
  poly(c.top, edge, top);
  if (glow) { // brilho barato (sem shadowBlur): contorno largo e translúcido
    ctx.beginPath();
    top.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath();
    ctx.strokeStyle = c.halo; ctx.lineWidth = sc * 0.3; ctx.stroke();
  }
}

const stars = Array.from({ length: 70 }, () => ({
  x: Math.random(), y: Math.random(), v: 0.02 + Math.random() * 0.05,
  a: 0.2 + Math.random() * 0.6, s: 1 + Math.random() * 2.5
}));

let last = performance.now(), ft = 16, fc = 0;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (state === 'play' && mov) {
    mov[mov.axis] += mov.dir * speed * dt;
    const top = stack[stack.length - 1];
    const c = top[mov.axis];
    if (mov[mov.axis] > c + RANGE) mov.dir = -1;
    if (mov[mov.axis] < c - RANGE) mov.dir = 1;
  }
  if (state === 'ready' && mov) { // demonstração parada no início
    mov[mov.axis] += mov.dir * speed * dt;
    if (mov[mov.axis] > RANGE) mov.dir = -1;
    if (mov[mov.axis] < -RANGE) mov.dir = 1;
  }

  cam += (camTarget - cam) * Math.min(dt * 5, 1);
  let dh = ((hueTarget - bgHue + 540) % 360) - 180;
  bgHue = (bgHue + dh * Math.min(dt * 2, 1) + 360) % 360;

  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i];
    d.vy -= 25 * dt; d.y += d.vy * dt;
    if (d.y <= cam - 25) debris.splice(i, 1);
  }
  for (let i = fx.length - 1; i >= 0; i--) {
    fx[i].t += dt * 2.2;
    if (fx[i].t >= 1) fx.splice(i, 1);
  }

  // resolução adaptativa: se o aparelho estiver lento, reduz a resolução do canvas
  ft = ft * 0.95 + dt * 1000 * 0.05;
  if (++fc > 60 && ft > 24 && dprCap > 1) { dprCap = Math.max(1, dprCap - 0.5); fc = 0; ft = 16; resize(); }

  // fundo tecnológico
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `hsl(${bgHue},70%,6%)`);
  g.addColorStop(1, `hsl(${(bgHue + 30) % 360},80%,16%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const step = Math.max(30, sc * 1.6);
  const offY = (cam * sc * 0.25) % step;
  ctx.strokeStyle = `hsla(${bgHue},100%,60%,0.07)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = (W / 2) % step; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = offY; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();

  ctx.fillStyle = `hsl(${bgHue},100%,80%)`;
  for (const s of stars) {
    s.y -= s.v * dt;
    if (s.y < 0) { s.y = 1; s.x = Math.random(); }
    ctx.globalAlpha = s.a;
    ctx.fillRect(s.x * W, s.y * H, s.s, s.s);
  }
  ctx.globalAlpha = 1;

  // blocos (só os visíveis)
  const from = Math.max(0, stack.length - 30);
  for (let i = from; i < stack.length; i++) box(stack[i], i >= stack.length - 4);
  if (mov) box(mov, true);
  for (const d of debris) box(d, false);

  // efeito de "perfeito"
  fx.forEach(f => {
    const e = f.t * 0.6;
    const pts = [P(f.x - e, f.y, f.z - e), P(f.x + f.w + e, f.y, f.z - e),
                 P(f.x + f.w + e, f.y, f.z + f.d + e), P(f.x - e, f.y, f.z + f.d + e)];
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath();
    ctx.strokeStyle = `rgba(255,255,255,${(1 - f.t) * 0.25})`;
    ctx.lineWidth = 8; ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${1 - f.t})`;
    ctx.lineWidth = 3; ctx.stroke();
  });

  requestAnimationFrame(frame);
}

state = 'ready';
bestEl.textContent = best ? 'Recorde: ' + best : '';
reset();
requestAnimationFrame(frame);
