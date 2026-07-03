"""Emberbrook — game host + mini save-sync API (single player).

Serves the game from /static and provides GET/POST /api/save protected by a
shared secret token (env EMBERBROOK_TOKEN). Storage: PostgreSQL if
DATABASE_URL is set (Railway Postgres plugin), otherwise a local JSON file
(fine for testing; add Postgres or a volume for durability).
Sync model: last-write-wins — the client decides using the save's own
timestamp; the server just stores the latest blob it is given.
"""
import json
import os
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

TOKEN = os.environ.get("EMBERBROOK_TOKEN", "changeme")
DB_URL = os.environ.get("DATABASE_URL", "")
FILE_PATH = Path(os.environ.get("SAVE_FILE", "data/save.json"))

app = FastAPI(title="Emberbrook", docs_url=None, redoc_url=None)

# ---------------------------------------------------------------- storage
# Single-user app: one short-lived connection per request is simpler and
# entirely sufficient — no pool needed.
def _pg_conn():
    import psycopg
    conn = psycopg.connect(DB_URL, autocommit=True)
    with conn.cursor() as cur:
        cur.execute(
            "CREATE TABLE IF NOT EXISTS save ("
            " id INT PRIMARY KEY,"
            " data JSONB NOT NULL,"
            " updated_at DOUBLE PRECISION NOT NULL)"
        )
    return conn

def store_get():
    if DB_URL:
        with _pg_conn() as conn, conn.cursor() as cur:
            cur.execute("SELECT data, updated_at FROM save WHERE id=1")
            row = cur.fetchone()
            if not row:
                return None
            return {"save": row[0], "server_ts": row[1]}
    if FILE_PATH.exists():
        blob = json.loads(FILE_PATH.read_text())
        return blob
    return None

def store_put(save_obj):
    now = time.time()
    if DB_URL:
        with _pg_conn() as conn, conn.cursor() as cur:
            cur.execute(
                "INSERT INTO save (id, data, updated_at) VALUES (1, %s, %s) "
                "ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data, "
                "updated_at=EXCLUDED.updated_at",
                (json.dumps(save_obj), now),
            )
        return now
    FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    FILE_PATH.write_text(json.dumps({"save": save_obj, "server_ts": now}))
    return now

# ------------------------------------------------------------------- api
def check_token(request: Request):
    tok = request.headers.get("x-eb-token", "")
    if not tok or tok != TOKEN:
        raise HTTPException(status_code=401, detail="bad token")

@app.get("/api/health")
def health():
    return {"ok": True, "storage": "postgres" if DB_URL else "file"}

@app.get("/api/save")
def get_save(request: Request):
    check_token(request)
    blob = store_get()
    if blob is None:
        return JSONResponse({"save": None, "server_ts": 0})
    return JSONResponse(blob)

@app.post("/api/save")
async def post_save(request: Request):
    check_token(request)
    body = await request.json()
    save_obj = body.get("save")
    if not isinstance(save_obj, dict):
        raise HTTPException(status_code=400, detail="save must be an object")
    if len(json.dumps(save_obj)) > 512_000:
        raise HTTPException(status_code=413, detail="save too large")
    ts = store_put(save_obj)
    return {"ok": True, "server_ts": ts}

# ----------------------------------------------------------------- static
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def index():
    return FileResponse("static/index.html")

@app.get("/{fname}")
def root_files(fname: str):
    """Serve manifest/sw/icons from the root scope (SW scope needs this)."""
    allowed = {"sw.js", "manifest.json", "icon-192.png", "icon-512.png",
               "game.js"}
    if fname in allowed:
        return FileResponse(f"static/{fname}")
    raise HTTPException(status_code=404)
