"""
Enrich the Africa emails DB with body text from emails-full.parquet.
Run from project root: python3 scripts/enrich_body.py

Safe to re-run: skips download if file exists, skips rows that already have a body.
"""

import sqlite3
import urllib.request
from pathlib import Path

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

    def _progress(count, block_size, total_size):
        pct = min(count * block_size / total_size * 100, 100)
        print(f"\r  {pct:.1f}%", end="", flush=True)

    urllib.request.urlretrieve(DOWNLOAD_URL, FULL_PARQUET, _progress)
    print(f"\r  Done. {FULL_PARQUET.stat().st_size / 1_000_000:.0f} MB written.")


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
    # Read in chunks to avoid loading all 334 MB into RAM at once
    matched: dict[str, str] = {}  # doc_id → body
    chunk_size = 100_000
    pf = pd.read_parquet(FULL_PARQUET, columns=["doc_id", "body"])

    for i in range(0, len(pf), chunk_size):
        chunk = pf.iloc[i : i + chunk_size]
        hits = chunk[chunk["doc_id"].isin(target_doc_ids)]
        for _, row in hits.iterrows():
            doc_id = row["doc_id"]
            body = row.get("body")
            if doc_id not in matched and body and str(body).strip():
                matched[doc_id] = str(body).strip()
        if (i // chunk_size) % 5 == 0:
            print(f"\r  Scanned {min(i + chunk_size, len(pf)):,} / {len(pf):,} rows ...", end="", flush=True)

    print(f"\r  Scan complete. {len(matched)} doc_ids matched out of {len(target_doc_ids)}.   ")

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
