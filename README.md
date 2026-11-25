# How to make a multiplayer game with OpenAI Codex

A worked example you can follow step by step: **Codex** builds a single-player browser game with
OpenAI's Game Studio plugin, then, with the **Edgegap** plugin and MCP server, turns it into online
matches: one authoritative server per match on Edgegap, bots in the empty seats, a Find Match
button, and the solo mode still working offline.

Slime Sumo is the game: four slimes on a round platform that shrinks, bump each other off, dash on
Space, last slime standing wins the round, first to 3 rounds wins.

This repo is a recipe, not a live demo. You create your own Edgegap app version and matchmaker,
play, and remove them when you're done. Each server stops itself when its match ends or empties,
so you only pay while people play.

```
Codex + Game Studio ──writes──> solo Phaser game (tag: before)
                                  │
Codex + Edgegap plugin ──────────> src/rules.js  shared by the page and the server
                                   server/       authoritative Node.js server, 4 seats, bots
                                   Dockerfile    linux/amd64 image, port 7777 WebSocket
                                  │
your page ──Find Match──> Edgegap matchmaker ──starts──> one server per match
     <──────────── wss://<id>.pr.edgegap.net:<port> ──  stops itself when the match ends
```

## What happened, in order

Every prompt is in [PROMPTS.md](PROMPTS.md), word for word. The git history keeps each stage.

1. **Solo game** (commit tagged `before`). One prompt with `$game-studio`: Codex wrote a Phaser +
   Vite game in about 5 minutes and fixed one bug of its own (the arena wasn't drawn on the start
   screen). Playtesting found one it missed: when the timer reached 00:00 with two or more slimes
   left, the round never ended.
2. **Online multiplayer** (next commit). One prompt with `$edgegap-vibe-coded`, Edgegap plugin and
   MCP server connected. In about 30 minutes, with no further input, Codex:
   - moved the rules into `src/rules.js`, imported by both the page and the server, and fixed the
     timer bug (at 00:00 the slime closest to the centre wins);
   - added the server from the `edgegap-threejs` templates: four seats, bots for empty ones,
     self-stop when the match ends or empties, a matchmaker ticket check;
   - added Find Match with `@edgegap/sdk`, plus a `?server=` link for joining a server directly;
   - ran a two-tab local test with Playwright and a container test on a random external port;
   - validated the Dockerfile with `edgegap_validate_server_config`, built and pushed the image,
     created the app and its version (`20261125-1613`, WebSocket with TLS on 7777);
   - deployed a test server tagged `agent-test`, joined it from two browser tabs over `wss://`,
     and left nothing running;
   - wrote the matchmaker profile instead of creating a matchmaker, as asked.
3. **Review** (last commits, by hand): the matchmaker token moved to a git-ignored
   `src/config.local.js`, the profile waits for a second player for 20 s before matching one alone
   (Codex's version matched every player alone at once), CI workflows, this README.

Verified on Edgegap on 2026-11-25: two browser tabs clicked **Find Match** on a shared matchmaker,
were matched onto one server in 16 seconds with two bots in the empty seats, and the server
stopped itself about 30 seconds after both tabs left.

## What you need

- OpenAI Codex (CLI, IDE extension or the ChatGPT desktop app) signed in with ChatGPT, with two
  plugins: **Game Studio** from the Plugins Directory, and **Edgegap**:

  ```bash
  codex plugin marketplace add edgegap/llm-agent-skills
  codex plugin add edgegap@edgegap
  ```

  The Edgegap plugin connects the hosted MCP server, which reads your
  [Edgegap API token](https://app.edgegap.com/user-settings?tab=tokens) (the UUID only) from the
  `EDGEGAP_API_TOKEN` environment variable. The token stays out of the project.
- An Edgegap account (app.edgegap.com). The free tier is enough: one matchmaker that stops about
  3 hours after each start, one server at a time.
- Docker logged in to your Edgegap registry (Container Registry page), or GitHub Actions
  (`.github/workflows/server-image.yml`).
- Node.js 22.

On Windows, the Codex CLI's sandbox only allowed reading files here, so step 2 ran with
`--dangerously-bypass-approvals-and-sandbox`, started in this folder. In the ChatGPT desktop app or
on macOS and Linux, the normal workspace-write sandbox applies.

## Run it

```bash
npm install
npm run dev                       # solo game at http://localhost:5173
```

Online, against a server you deployed (Edgegap dashboard > Deployments: `wss://<fqdn>:<external port>`):

```
http://localhost:5173/?server=wss://<fqdn>:<port>
```

With a matchmaker: add [matchmaker/slime-sumo.json](matchmaker/slime-sumo.json)'s profile to your
matchmaker (use your own app version name), add your page's origin to `allowed_cors_origins`, then
create `src/config.local.js` (git-ignored):

```js
export default { url: 'https://<id>.edgegap.net', token: '<matchmaker auth token>' };
```

The matchmaker Auth Token is a client token, made to ship in game pages. Never put your Edgegap API
token in the page, the repo or the image.

Tests: `node tools/e2e-local.mjs` (local server, two headless Chrome tabs) and
`node tools/e2e-container.mjs ws://127.0.0.1:<port>` against `docker run -p <port>:7777`.

## Keep Codex on track

Copy the Edgegap section from
[`skills/edgegap/assets/AGENTS.md`](https://github.com/edgegap/llm-agent-skills/blob/main/skills/edgegap/assets/AGENTS.md)
into your repo's `AGENTS.md`: authoritative server, token never in the repo, timestamped image tags,
ask before deploying.

## Clean up

Each server stops itself. When you're done: stop the matchmaker, and delete the app version and
image if you don't need them.

## Licence

MIT. Phaser is MIT-licensed.
