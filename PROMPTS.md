# Prompts

Every prompt given to Codex for this sample, in order, word for word.

Setup: Codex CLI 0.172.0, signed in with ChatGPT, default model, reasoning effort medium. Plugins: OpenAI's Game Studio (0.1.2) for step 1; the Edgegap plugin and MCP server for step 2.

## Step 1: the solo game (Game Studio only, Edgegap plugin off)

```text
Use $game-studio. Make a small browser game called Slime Sumo with Phaser: a top-down arena where 4 slimes try to bump each other off a round platform that slowly shrinks. The player controls one slime with WASD or the arrow keys, plus a dash on Space; the other three are bots. Last slime on the platform wins the round; first to 3 rounds wins the match. Keep it simple: shapes and colors, no external assets. Use Vite, and make sure it runs with npm install && npm run dev.
```
