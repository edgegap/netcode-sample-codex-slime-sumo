import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { addSlime, makeWorld, stepWorld } from '../src/rules.js';

const root = process.cwd();
const env = { ...process.env, WAIT_SECONDS: '2', COUNTDOWN_SECONDS: '1', MATCH_SECONDS: '240', EMPTY_TIMEOUT_S: '60' };
const directServerUrl = process.env.SERVER_URL;
const server = directServerUrl ? null : spawn(process.execPath, ['server/main.js'], { cwd: root, env, stdio: 'inherit' });
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host=127.0.0.1', '--port=5173'], { cwd: root, stdio: 'inherit' });
let browser;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
async function waitReady(url) {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await delay(200);
  }
  throw new Error(`Service did not start: ${url}`);
}
try {
  await Promise.all([waitReady('http://127.0.0.1:5173/'), ...(directServerUrl ? [] : [waitReady('http://127.0.0.1:7777/')])]);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const contexts = [await browser.newContext({ viewport: { width: 1440, height: 1000 } }), await browser.newContext({ viewport: { width: 1440, height: 1000 } })];
  const tabs = await Promise.all(contexts.map((c) => c.newPage()));
  const messages = tabs.map(() => []);
  const welcomedIds = [];
  tabs.forEach((page) => { page.on('console', (m) => m.type() === 'error' && console.error('browser:', m.text())); page.on('pageerror', (e) => console.error('page error:', e.message)); });
  tabs.forEach((page, i) => page.on('websocket', (ws) => ws.on('framereceived', ({ payload }) => {
    try { const msg = JSON.parse(payload); if (msg.t === 'state') messages[i].push({ at: Date.now(), msg }); if (msg.t === 'welcome') welcomedIds[i] = msg.id; } catch {}
  })));
  const wsUrl = directServerUrl || 'ws://127.0.0.1:7777';
  const url = `http://127.0.0.1:5173/?server=${encodeURIComponent(wsUrl)}`;
  await Promise.all(tabs.map((page) => page.goto(url)));
  try { await Promise.all(tabs.map((page) => page.waitForFunction(() => document.querySelector('#connection-status')?.textContent?.includes('Connected'), null, { timeout: 20000 }))); }
  catch { console.error('connection statuses:', await Promise.all(tabs.map((page) => page.locator('#connection-status').textContent()))); throw new Error('Browser tabs did not connect'); }
  const end = Date.now() + 20000;
  while (Date.now() < end && tabs.some((_, i) => !messages[i].some(({ msg }) => msg.phase === 'playing' && msg.s.players.length === 4))) await delay(200);
  assert(tabs.every((_, i) => messages[i].some(({ msg }) => msg.phase === 'playing' && msg.s.players.length === 4)), 'Both tabs did not enter a four-seat match');
  assert(await tabs[0].locator('#play-button').isDisabled(), 'Online play left the Solo button active');

  const initial = messages[0].at(-1).msg;
  const playerId = welcomedIds[0];
  assert(playerId, 'Tab one did not receive its player assignment');
  const startPos = initial.s.players.find((p) => p.id === playerId);
  await tabs[0].bringToFront(); await tabs[0].keyboard.down('d'); await delay(700); await tabs[0].keyboard.up('d');
  const movedBy = Date.now() + 5000;
  let latest;
  do {
    latest = messages[0].at(-1)?.msg;
    const pos = latest?.s.players.find((p) => p.id === playerId);
    if (pos && Math.hypot(pos.x - startPos.x, pos.y - startPos.y) > 5) break;
    await delay(100);
  } while (Date.now() < movedBy);
  const finalPos = latest?.s.players.find((p) => p.id === playerId);
  assert(finalPos && Math.hypot(finalPos.x - startPos.x, finalPos.y - startPos.y) > 5, 'Keyboard movement did not reach the authoritative server');

  const stateA = messages[0].at(-1), stateB = messages[1].at(-1);
  assert(stateA && stateB && Math.abs(stateA.at - stateB.at) < 300, 'Could not compare synchronized snapshots from both tabs');
  for (const p of stateA.msg.s.players) {
    const peer = stateB.msg.s.players.find((q) => q.id === p.id);
    assert(peer && Math.hypot(peer.x - p.x, peer.y - p.y) < 1, `Tabs disagree about player ${p.id}`);
  }
  const screenshot = process.env.SCREENSHOT_PATH || join(tmpdir(), 'slime-sumo-online.png');
  await tabs[0].screenshot({ path: screenshot });

  const round = makeWorld();
  addSlime(round, { id: 'center', name: 'CENTER', slot: 0 }); addSlime(round, { id: 'edge', name: 'EDGE', slot: 1 });
  round.players[0].x = 360; round.players[0].y = 318; round.players[1].x = 390; round.players[1].y = 318;
  round.elapsed = 59.99; const timeoutWinner = stepWorld(round, .02);
  assert(timeoutWinner === 'center', 'The 00:00 timeout did not award the round to the closest remaining slime');

  const soloContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const solo = await soloContext.newPage(); await solo.goto('http://127.0.0.1:5173/');
  await solo.locator('#play-button').click();
  await solo.waitForFunction(() => document.querySelector('#phase-label')?.textContent === 'FIGHT!', null, { timeout: 3000 });
  assert((await solo.locator('#connection-status').textContent()).includes('offline'), 'Solo mode did not stay offline');

  console.log(JSON.stringify({ result: 'pass', browserTabs: 2, fourSeats: true, movement: 'authoritative', snapshots: 'match across tabs', timeoutWinner, soloOffline: true, screenshot }, null, 2));
  await soloContext.close(); await Promise.all(contexts.map((c) => c.close()));
} finally {
  if (browser) await browser.close();
  for (const proc of [server, vite]) { proc?.kill(); }
}
