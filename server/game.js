import { axisIn, ffaResult } from './util.js';
import { addSlime, makeWorld, removeSlime, resetRound, stepWorld } from '../src/rules.js';

const WINS_TO_MATCH = 3;
export function createGame() {
  const world = makeWorld();
  let nextRoundAt = 0;
  return {
    name: 'slime-sumo',
    config: { tickHz: 30, sendHz: 20, maxPlayers: 4, botFill: 4, matchSeconds: 240 },
    info: () => ({ width: 720, height: 620, winsToMatch: WINS_TO_MATCH }),
    addPlayer(p) {
      const used = new Set(world.players.map((s) => s.slot));
      let slot = 0; while (used.has(slot) && slot < 4) slot++;
      const slime = addSlime(world, { id: p.id, name: p.name, bot: p.bot, slot });
      slime.score = p.score || 0;
    },
    removePlayer(p) { removeSlime(world, p.id); },
    input(p, msg) {
      const s = world.players.find((x) => x.id === p.id);
      if (!s) return;
      s.input = { x: axisIn(msg.x), y: axisIn(msg.y), dash: msg.dash === true };
    },
    start(room) {
      for (const p of room.players.values()) p.score = 0;
      for (const s of world.players) s.score = 0;
      world.round = 1; nextRoundAt = 0; resetRound(world);
    },
    update(dt, room) {
      if (world.roundWinner !== null) {
        if (!nextRoundAt) {
          const winner = room.players.get(world.roundWinner);
          if (winner) { winner.score++; const slime = world.players.find((s) => s.id === winner.id); if (slime) slime.score = winner.score; }
          nextRoundAt = Date.now() + 2200;
        } else if (Date.now() >= nextRoundAt) {
          world.round++; nextRoundAt = 0; resetRound(world);
        }
        return;
      }
      stepWorld(world, dt);
    },
    result(room) {
      return [...room.players.values()].some((p) => p.score >= WINS_TO_MATCH) ? ffaResult(room) : null;
    },
    timeUp: (room) => ffaResult(room, ' on time'),
    snapshot() {
      return { round: world.round, radius: Math.round(world.radius * 100) / 100,
        roundRemaining: Math.max(0, Math.ceil(60 - world.elapsed)), roundWinner: world.roundWinner,
        players: world.players.map((s) => ({ id: s.id, slot: s.slot, name: s.name, bot: s.bot,
          score: s.score || 0, x: Math.round(s.x * 100) / 100, y: Math.round(s.y * 100) / 100,
          vx: Math.round(s.vx * 100) / 100, vy: Math.round(s.vy * 100) / 100, alive: s.alive,
          angle: s.angle, dashTime: s.dashTime })) };
    },
  };
}
