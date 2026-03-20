"""
Enrich the Africa emails DB with body text from emails-full.parquet.
Run from project root: python3 scripts/enrich_body.py

Safe to re-run: skips download if file exists, skips rows that already have a body.
"""

import sqlite3
import urllib.request
from pathlib import Path
import subprocess

import pandas as pd

FULL_PARQUET = Path("data/jmail/emails-full.parquet")
DB_PATH = Path("web/data/epstein_africa.db")
DOWNLOAD_URL = "https://data.jmail.world/v1/emails.parquet"


def download_if_missing():
    if FULL_PARQUET.exists():
        size_mb = FULL_PARQUET.stat().st_size / 1_000_000
        print(f"  {FULL_PARQUET} already exists ({size_mb:.0f} MB), skipping download.")
        return

    FULL_PARQUET.parent.mkdir(parents=True, exist_ok=True)
    print(f"  Downloading {DOWNLOAD_URL} → {FULL_PARQUET} ...")
    print("  (334 MB — this will take a while)")

    result = subprocess.run([
        "curl", "-L", "--progress-bar",
        "-H", "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "-o", str(FULL_PARQUET),
        DOWNLOAD_URL,
    ])

    if result.returncode != 0:
        FULL_PARQUET.unlink(missing_ok=True)
        raise RuntimeError(f"Download failed (curl exit {result.returncode})")

    print(f"  Done. {FULL_PARQUET.stat().st_size / 1_000_000:.0f} MB written.")


def main():
    # ── 1. Download ────────────────────────────────────────────────────────────
    download_if_missing()

    # ── 2. Fetch doc_ids that still need a body ────────────────────────────────
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Add body column if it doesn't exist yet
    existing_cols = {row[1] for row in cur.execute("PRAGMA table_info(emails)")}
    if "body" not in existing_cols:
        print("  Adding body column to emails table ...")
        cur.execute("ALTER TABLE emails ADD COLUMN body TEXT")
        conn.commit()

    rows = cur.execute(
        "SELECT id, doc_id FROM emails WHERE body IS NULL AND doc_id IS NOT NULL"
    ).fetchall()

    if not rows:
        print("  Nothing to enrich — all rows already have a body.")
        conn.close()
        return

    # Map doc_id → email id (may be many-to-one if doc has multiple recipients)
    doc_to_ids: dict[str, list[str]] = {}
    for email_id, doc_id in rows:
        doc_to_ids.setdefault(doc_id, []).append(email_id)

    target_doc_ids = set(doc_to_ids.keys())
    print(f"  {len(rows)} emails need body text ({len(target_doc_ids)} unique doc_ids).")

    # ── 3. Load only matching rows from full parquet ───────────────────────────
    print(f"  Reading {FULL_PARQUET} (filtering to target doc_ids) ...")
    pf = pd.read_parquet(FULL_PARQUET, columns=["doc_id", "content_markdown"])
    hits = pf[pf["doc_id"].isin(target_doc_ids)]

    matched: dict[str, str] = {}  # doc_id → body
    for _, row in hits.iterrows():
        doc_id = row["doc_id"]
        body = row.get("content_markdown")
        if doc_id not in matched and body and str(body).strip():
            matched[doc_id] = str(body).strip()

    print(f"  Scan complete. {len(matched)} doc_ids matched out of {len(target_doc_ids)}.")

    # ── 4. Write matched bodies back to DB ────────────────────────────────────
    updates = []
    for doc_id, body in matched.items():
        for email_id in doc_to_ids[doc_id]:
            updates.append((body, email_id))

    if updates:
        cur.executemany("UPDATE emails SET body = ? WHERE id = ?", updates)
        conn.commit()
        print(f"  Updated {len(updates)} email rows with body text.")

    # ── 5. Report ──────────────────────────────────────────────────────────────
    unmatched = target_doc_ids - set(matched.keys())
    print(f"\n  Matched:   {len(matched)} doc_ids ({len(updates)} rows updated)")
    print(f"  No body:   {len(unmatched)} doc_ids had no body in full parquet")
    if unmatched:
        print(f"  Sample unmatched: {list(unmatched)[:5]}")

    conn.close()


if __name__ == "__main__":
    main()
