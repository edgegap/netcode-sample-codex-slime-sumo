// DOM- and Phaser-free Slime Sumo rules. Used by both the offline client and server.
export const COLORS = [0xc9ef63, 0xff816f, 0x70d6db, 0xc09aff];
export const NAMES = ['YOU', 'BUBBLE', 'MISO', 'PICKLE'];
export const ARENA = { width: 720, height: 620, centerX: 360, centerY: 318, radius: 244 };
export const ROUND_SECONDS = 60;
export const WINS_TO_MATCH = 3;

export function makeWorld() {
  return { players: [], centerX: ARENA.centerX, centerY: ARENA.centerY, baseRadius: ARENA.radius,
    radius: ARENA.radius, elapsed: 0, round: 1, roundWinner: null, roundScored: false };
}

export function addSlime(world, { id, name, bot = false, slot }) {
  const idx = slot ?? world.players.length;
  const s = { id, name: name || NAMES[idx], bot, slot: idx, x: 0, y: 0, vx: 0, vy: 0, radius: 22,
    alive: true, angle: 0, cooldown: 0, dashTime: 0, bob: Math.random() * 7,
    input: { x: 0, y: 0, dash: false } };
  world.players.push(s);
  return s;
}

export function removeSlime(world, id) { world.players = world.players.filter((s) => s.id !== id); }

export function resetRound(world) {
  const angles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
  world.radius = world.baseRadius; world.elapsed = 0; world.roundWinner = null; world.roundScored = false;
  world.players.forEach((s) => {
    const a = angles[s.slot % 4] + (Math.random() - .5) * .45;
    s.x = world.centerX + Math.cos(a) * 110; s.y = world.centerY + Math.sin(a) * 110;
    s.vx = 0; s.vy = 0; s.alive = true; s.angle = a + Math.PI; s.cooldown = 0; s.dashTime = 0;
    s.input = { x: 0, y: 0, dash: false };
  });
}

function chooseTarget(world, s) {
  return world.players.filter((p) => p !== s && p.alive)
    .sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y))[0] || null;
}

function collide(world) {
  for (let i = 0; i < world.players.length; i++) for (let j = i + 1; j < world.players.length; j++) {
    const a = world.players[i], b = world.players[j]; if (!a.alive || !b.alive) continue;
    let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.radius + b.radius - 3;
    if (d >= min) continue; if (!d) { dx = 1; dy = 0; d = 1; }
    const nx = dx / d, ny = dy / d, over = min - d;
    a.x -= nx * over * .5; a.y -= ny * over * .5; b.x += nx * over * .5; b.y += ny * over * .5;
    const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rel < 0) { const impulse = -rel * .8 + 22; a.vx -= nx * impulse; a.vy -= ny * impulse; b.vx += nx * impulse; b.vy += ny * impulse; }
    if (a.dashTime > 0) { b.vx += nx * 240; b.vy += ny * 240; }
    if (b.dashTime > 0) { a.vx -= nx * 240; a.vy -= ny * 240; }
  }
}

function timeoutWinner(world, alive) {
  // At 00:00, the slime nearest the middle wins. Slot order resolves an exact tie.
  return alive.slice().sort((a, b) => Math.hypot(a.x - world.centerX, a.y - world.centerY) -
    Math.hypot(b.x - world.centerX, b.y - world.centerY) || a.slot - b.slot)[0]?.id ?? null;
}

export function stepWorld(world, dt) {
  if (world.roundWinner !== null) return world.roundWinner;
  dt = Math.min(dt, .035);
  world.elapsed += dt;
  world.radius = Math.max(111, world.baseRadius - Math.max(0, world.elapsed - 5) * 2.15);
  for (const s of world.players) {
    if (!s.alive) continue;
    s.cooldown = Math.max(0, s.cooldown - dt); s.dashTime = Math.max(0, s.dashTime - dt);
    let ix = s.input.x, iy = s.input.y;
    if (s.bot) {
      const target = chooseTarget(world, s);
      if (target) {
        let dx = target.x - s.x, dy = target.y - s.y, d = Math.hypot(dx, dy) || 1;
        const safe = Math.hypot(s.x - world.centerX, s.y - world.centerY);
        ix = dx / d + (safe > world.radius - 70 ? (world.centerX - s.x) / Math.max(safe, 1) * 1.9 : 0);
        iy = dy / d + (safe > world.radius - 70 ? (world.centerY - s.y) / Math.max(safe, 1) * 1.9 : 0);
        const mag = Math.hypot(ix, iy) || 1; ix /= mag; iy /= mag;
        if (d < 93 && s.cooldown <= 0 && Math.random() < .025) {
          s.vx += dx / d * 350; s.vy += dy / d * 350; s.cooldown = 1.4; s.dashTime = .2;
        }
      }
    }
    if (s.input.dash && s.cooldown <= 0) {
      s.vx += Math.cos(s.angle) * 510; s.vy += Math.sin(s.angle) * 510; s.cooldown = 1.15; s.dashTime = .22;
    }
    s.input.dash = false;
    if (ix || iy) { const m = Math.hypot(ix, iy); ix /= m; iy /= m; s.angle = Math.atan2(iy, ix); s.vx += ix * 390 * dt; s.vy += iy * 390 * dt; }
    const drag = Math.pow(.91, dt * 60); s.vx *= drag; s.vy *= drag;
    const max = s.dashTime > 0 ? 510 : 196, speed = Math.hypot(s.vx, s.vy);
    if (speed > max) { s.vx = s.vx / speed * max; s.vy = s.vy / speed * max; }
    s.x += s.vx * dt; s.y += s.vy * dt;
  }
  collide(world);
  for (const s of world.players) if (s.alive && Math.hypot(s.x - world.centerX, s.y - world.centerY) > world.radius - s.radius * .35) s.alive = false;
  const alive = world.players.filter((s) => s.alive);
  if (alive.length === 0) world.roundWinner = timeoutWinner(world, world.players);
  else if (alive.length === 1) world.roundWinner = alive[0].id;
  else if (world.elapsed >= ROUND_SECONDS) world.roundWinner = timeoutWinner(world, alive);
  return world.roundWinner;
}
