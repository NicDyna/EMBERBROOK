# Emberbrook

A tiny medieval RPG (RuneScape-inspired, single player) for mobile browser and
desktop, with cloud save sync between your devices. FastAPI serves the game and
a minimal save API; the game itself is dependency-free vanilla JS on canvas.

## Repository layout

```
main.py            FastAPI app: serves the game + /api/save sync endpoint
requirements.txt   fastapi, uvicorn, psycopg
railway.toml       Railway build/start config
static/
  index.html       game shell (CSS + DOM)
  game.js          the whole game (assembled from src/, see below)
  sw.js            service worker (offline cache, PWA)
  manifest.json    PWA manifest
  icon-*.png       app icons
src/p1.js … p8.js  game source in layers — edit these, then rebuild game.js
smoke.js           headless test suite (dev only, needs jsdom)
SPEC.md            full game design document
```

`static/game.js` is simply the concatenation of `src/p1.js` through `p8.js`:

```
cat src/p1.js src/p2.js src/p3.js src/p4.js src/p5.js src/p6.js src/p7.js src/p8.js > static/game.js
```

Claude Code can do this after any edit. Never edit `static/game.js` directly.

## Deploy (GitHub + Railway)

1. **Create the GitHub repo.** On github.com: New repository → name it
   `emberbrook` (private is fine) → create. Then either:
   - **GitHub web:** "uploading an existing file" → drag the whole folder
     contents in → Commit. (Drag the files and the `static`/`src` folders,
     not the outer folder itself.)
   - **GitHub Desktop:** Add local repository → choose this folder →
     publish to GitHub.

2. **Create the Railway service.** railway.app → New Project →
   Deploy from GitHub repo → pick `emberbrook`. Railway detects Python via
   `railway.toml` and starts uvicorn automatically.

3. **Add Postgres.** In the Railway project: New → Database → PostgreSQL.
   Railway injects `DATABASE_URL` into the service automatically once you
   attach it (service → Variables → check `DATABASE_URL` is referenced;
   if not: Add Variable Reference → Postgres → DATABASE_URL).
   Without Postgres the server falls back to a JSON file, which is wiped on
   every redeploy — fine for a quick test, not for real progress.

4. **Set the secret token.** Service → Variables → New Variable:
   `EMBERBROOK_TOKEN` = any long random string (this is your personal key —
   treat it like a password).

5. **Get a URL.** Service → Settings → Networking → Generate Domain.
   Open it — the game loads.

6. **Enable sync on each device.** In the game: ⚙️ Settings → Cloud sync →
   paste the same token → Sync now. Do this once on your phone and once on
   your desktop. From then on the newest save wins automatically
   (pull on open/focus, push after saves).

7. **Install as an app (optional).** On Android Chrome: menu → Add to Home
   screen. On iOS Safari: Share → Add to Home Screen.

## Updating the game later

- Edit `src/*.js`, rebuild `static/game.js` (command above), then **bump the
  version in two places, keeping them in sync**, so clients fetch the new code:
  - `static/sw.js` — the `CACHE` constant (`emberbrook-v2.5.2` → `v2.5.3`).
  - `static/index.html` — the `?v=` on the `game.js` script tag.
- The service worker is **network-first with `cache: 'no-store'`**, so an online
  player already gets the newest build on reload; the version bumps refresh the
  offline copy and force-bust any stale HTTP cache.
- Commit + push (GitHub Desktop) → Railway redeploys automatically.
- Players can wipe everything (local save + cloud + cached code) from
  **Settings ⚙️ → Reset character**.

## Tests

```
npm install jsdom        # once, in the repo folder
node smoke.js            # ~50 assertions: maps, combat, loot, death, saves
python -m pytest         # (none yet — API was verified with TestClient)
```

## Save data & backup

- Local: browser localStorage (`emberbrook_v2`), autosaved every 8 s.
- Cloud: single row on your server, last-write-wins by save timestamp.
- Manual: Settings → Export gives a base64 save code; Import restores it.
- A v1 save (`emberbrook_v1`) found in the browser is migrated automatically
  on first load (combat XP splits evenly into Attack/Strength/Defence).
