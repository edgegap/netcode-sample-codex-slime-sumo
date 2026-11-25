import WebSocket from 'ws';

const url = process.argv[2] || 'ws://127.0.0.1:31504';
const ws = new WebSocket(url);
let states = 0;
const timeout = setTimeout(() => { console.error(`No four-seat match arrived from ${url}`); ws.terminate(); process.exitCode = 1; }, 20000);
ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', name: 'Container check' })));
ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.t === 'error') { console.error(msg.message); process.exitCode = 1; ws.close(); }
  if (msg.t === 'welcome') console.log(`joined as player ${msg.id}`);
  if (msg.t === 'state') {
    states++;
    if (msg.phase === 'playing' && msg.s.players.length === 4) {
      clearTimeout(timeout);
      console.log(JSON.stringify({ result: 'pass', phase: msg.phase, seats: msg.s.players.length, bots: msg.s.players.filter((p) => p.bot).length, snapshots: states }));
      ws.close();
    }
  }
});
ws.on('error', (err) => { clearTimeout(timeout); console.error(err.message); process.exitCode = 1; });
ws.on('close', () => clearTimeout(timeout));
