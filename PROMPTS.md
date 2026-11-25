# Prompts

Every prompt given to Codex for this sample, in order, word for word. Values in angle brackets were the real ones in the run.

Setup: Codex CLI 0.172.0, signed in with ChatGPT, default model, reasoning effort medium. Plugins: OpenAI's Game Studio (0.1.2) for step 1; the Edgegap plugin and MCP server for step 2.

## Step 1: the solo game (Game Studio only, Edgegap plugin off)

```text
Use $game-studio. Make a small browser game called Slime Sumo with Phaser: a top-down arena where 4 slimes try to bump each other off a round platform that slowly shrinks. The player controls one slime with WASD or the arrow keys, plus a dash on Space; the other three are bots. Last slime on the platform wins the round; first to 3 rounds wins the match. Keep it simple: shapes and colors, no external assets. Use Vite, and make sure it runs with npm install && npm run dev.
```

## Step 2: online multiplayer (Edgegap plugin and MCP server on)

Codex ran with `--dangerously-bypass-approvals-and-sandbox` in this folder: on Windows the CLI's sandbox only allowed reading, and Codex stopped without editing on the first try. Before this prompt: Docker logged in to `registry.edgegap.com` with the registry login from the Edgegap dashboard, and `EDGEGAP_API_TOKEN` set in the environment Codex started from.

```text
Use $edgegap-vibe-coded. Make Slime Sumo online multiplayer on Edgegap: up to 4 players per match on one authoritative server, bots take the empty seats, a Find Match button that goes through Edgegap's matchmaker, and the solo mode keeps working offline. Playtest note: when the timer reaches 00:00 the round never ends if two or more slimes are still on the platform; fix that too.
Docker is already logged in to registry.edgegap.com; my registry project is <registry-project>. Build the server image, push it, create the app slime-sumo and a version for it, then deploy one test server and prove that two browser tabs can join it directly. You can deploy test servers without asking me; tag them agent-test and stop them when you're done. Don't create a matchmaker: write the matchmaker profile JSON and I'll add it to my existing matchmaker. Don't commit.
```
