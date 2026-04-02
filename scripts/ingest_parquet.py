#!/usr/bin/env python3
"""
Ingest Africa-relevant emails from the full parquet into the production
and/or research SQLite databases.

Usage:
    python scripts/ingest_parquet.py --tier1          # Production DB (Tier 1 only)
    python scripts/ingest_parquet.py --research        # Research DB (all tiers)
    python scripts/ingest_parquet.py --tier1 --research # Both
    python scripts/ingest_parquet.py --tier1 --dry-run  # Count only, no writes
"""

import argparse
import os
import re
import sqlite3
import sys
from pathlib import Path

import pandas as pd

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent
FULL_PARQUET = ROOT / "data" / "jmail" / "emails-full.parquet"
PROD_DB = ROOT / "web" / "data" / "epstein_africa.db"
RESEARCH_DB = ROOT / "web" / "data" / "research.db"

# ---------------------------------------------------------------------------
# Country detection — mirrors web/lib/countries.js exactly
# ---------------------------------------------------------------------------
COUNTRY_KEYWORDS = {
    "kenya": "Kenya", "nairobi": "Kenya", "mombasa": "Kenya",
    "nigeria": "Nigeria", "lagos": "Nigeria", "abuja": "Nigeria",
    "ivory coast": "Ivory Coast", "côte d'ivoire": "Ivory Coast",
    "cote d'ivoire": "Ivory Coast", "abidjan": "Ivory Coast",
    "south africa": "South Africa", "cape town": "South Africa",
    "johannesburg": "South Africa", "durban": "South Africa",
    "joburg": "South Africa", "pretoria": "South Africa",
    "senegal": "Senegal", "dakar": "Senegal",
    "zimbabwe": "Zimbabwe", "harare": "Zimbabwe", "mugabe": "Zimbabwe",
    "somalia": "Somalia", "somaliland": "Somalia", "mogadishu": "Somalia",
    "ethiopia": "Ethiopia", "addis ababa": "Ethiopia",
    "tanzania": "Tanzania", "dar es salaam": "Tanzania",
    "ghana": "Ghana", "accra": "Ghana",
    "morocco": "Morocco", "marrakech": "Morocco", "marrakesh": "Morocco",
    "marakash": "Morocco", "bin ennakhil": "Morocco", "rabat": "Morocco",
    "rwanda": "Rwanda", "kigali": "Rwanda", "kagame": "Rwanda",
    "uganda": "Uganda", "kampala": "Uganda",
    "egypt": "Egypt", "cairo": "Egypt", "alexandria": "Egypt",
    "liberia": "Liberia",
    "sierra leone": "Sierra Leone", "freetown": "Sierra Leone",
    "sudan": "Sudan", "khartoum": "Sudan",
    "congo": "Congo", "kinshasa": "Congo", "brazzaville": "Congo",
    "kabila": "Congo",
    "gabon": "Gabon", "libreville": "Gabon",
    "madagascar": "Madagascar",
    "mozambique": "Mozambique", "maputo": "Mozambique",
    "zambia": "Zambia", "lusaka": "Zambia",
    "botswana": "Botswana", "gaborone": "Botswana",
    "cameroon": "Cameroon",
    "angola": "Angola", "luanda": "Angola",
    "mauritius": "Mauritius", "seychelles": "Seychelles",
    "mali": "Mali", "bamako": "Mali",
    "libya": "Libya", "tripoli": "Libya",
    "tunisia": "Tunisia", "tunis": "Tunisia",
    "djibouti": "Djibouti",
    "burkina faso": "Burkina Faso", "togo": "Togo",
    "benin": "Benin", "niger": "Niger",
    "africa": "Africa",
    "dangote": "Nigeria", "sol kerzner": "South Africa",
    "kerzner": "South Africa", "sun city": "South Africa",
    "bongo": "Gabon", "karim wade": "Senegal", "zuma": "South Africa",
}

_COUNTRY_PATTERNS = [
    (re.compile(r"\b" + re.escape(kw) + r"\b", re.IGNORECASE), country)
    for kw, country in COUNTRY_KEYWORDS.items()
]


def detect_countries(text):
    """Return comma-separated country names found in text."""
    if not text:
        return ""
    seen = {}
    for pat, country in _COUNTRY_PATTERNS:
        if pat.search(text):
            seen[country] = True
    return ", ".join(seen.keys())


def combined_text(row):
    """Build combined search text from email fields."""
    parts = [
        re.sub(r"<[^>]+>", " ", str(row.get("subject", "") or "")),
        str(row.get("sender", "") or ""),
        str(row.get("all_participants", "") or ""),
        str(row.get("content_markdown", "") or ""),
    ]
    return " ".join(parts)


# ---------------------------------------------------------------------------
# Africa keyword filter for body text
# ---------------------------------------------------------------------------
AFRICA_GEO_KEYWORDS = [
    # Countries
    "kenya", "nigeria", "ivory coast", "cote d'ivoire", "south africa",
    "senegal", "zimbabwe", "somalia", "somaliland", "ethiopia", "tanzania",
    "morocco", "marrakech", "marrakesh", "libya", "tripoli", "benghazi",
    "gabon", "libreville", "djibouti", "sudan", "khartoum", "rwanda",
    "kigali", "ghana", "accra", "cameroon", "mozambique", "congo",
    "angola", "uganda", "madagascar", "mauritius", "namibia", "botswana",
    "zambia", "malawi", "tunisia", "algeria", "egypt", "cairo",
    # Cities
    "abidjan", "dakar", "nairobi", "lagos", "abuja", "johannesburg",
    "cape town", "durban", "pretoria", "dar es salaam", "addis ababa",
    "mogadishu", "harare", "casablanca", "mombasa", "zanzibar",
    "freetown", "monrovia", "bamako", "niamey", "ouagadougou",
    "lome", "cotonou", "douala", "kinshasa", "luanda", "kampala",
    "maputo", "windhoek", "gaborone", "lusaka", "lilongwe", "tunis",
    "algiers",
    # General
    "african", "afrika", "boko haram", "safari", "apartheid",
]

AFRICA_PERSON_KEYWORDS = [
    "sultan bin sulayem", "sulayem", "karim wade", "nina keita",
    "ouattara", "rod-larsen", "nikolic", "boris nikolic", "ehud barak",
    "peggy siegal", "daniel siad", "jide zeitlin", "shaher abdulhak",
    "mark lloyd", "gregory brown", "jabor", "al thani",
]

_GEO_RE = re.compile(
    "|".join(r"\b" + re.escape(kw) + r"\b" for kw in AFRICA_GEO_KEYWORDS),
    re.IGNORECASE,
)

_PERSON_RE = re.compile(
    "|".join(r"\b" + re.escape(kw) + r"\b" for kw in AFRICA_PERSON_KEYWORDS),
    re.IGNORECASE,
)


def is_africa_geo_in_body(body):
    """True if body contains an Africa geographic keyword."""
    if not body:
        return False
    return bool(_GEO_RE.search(str(body)))


def is_africa_match_any(row):
    """True if any field matches any Africa keyword (geo or person)."""
    text = combined_text(row)
    return bool(_GEO_RE.search(text)) or bool(_PERSON_RE.search(text))


# ---------------------------------------------------------------------------
# DB operations
# ---------------------------------------------------------------------------
CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS emails (
    id                TEXT PRIMARY KEY,
    doc_id            TEXT,
    sender            TEXT,
    subject           TEXT,
    to_recipients     TEXT,
    sent_at           TEXT,
    countries         TEXT,
    release_batch     INTEGER,
    epstein_is_sender INTEGER,
    is_promotional    INTEGER,
    all_participants  TEXT,
    body              TEXT
)
"""

CREATE_FTS_SQL = """
CREATE VIRTUAL TABLE IF NOT EXISTS emails_fts USING fts5(
    id UNINDEXED,
    sender,
    subject,
    body,
    content='emails',
    content_rowid='rowid'
)
"""


def get_existing_ids(db_path):
    """Return set of all email IDs already in the database."""
    if not db_path.exists():
        return set()
    conn = sqlite3.connect(str(db_path))
    try:
        ids = {row[0] for row in conn.execute("SELECT id FROM emails")}
    except sqlite3.OperationalError:
        ids = set()
    conn.close()
    return ids


def init_db(db_path):
    """Ensure the DB has the required tables."""
    conn = sqlite3.connect(str(db_path))
    conn.execute(CREATE_TABLE_SQL)
    try:
        conn.execute(CREATE_FTS_SQL)
    except sqlite3.OperationalError:
        pass  # FTS table already exists
    conn.commit()
    conn.close()


def insert_rows(db_path, rows, existing_ids):
    """Insert rows into the database, skipping existing IDs. Returns count."""
    conn = sqlite3.connect(str(db_path))
    inserted = 0
    for row in rows:
        email_id = row["id"]
        if email_id in existing_ids:
            continue
        conn.execute(
            """INSERT OR IGNORE INTO emails
               (id, doc_id, sender, subject, to_recipients, sent_at,
                countries, release_batch, epstein_is_sender, is_promotional,
                all_participants, body)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                email_id,
                row["doc_id"],
                row["sender"],
                row["subject"],
                row["to_recipients"],
                row["sent_at"],
                row["countries"],
                row.get("release_batch"),
                row.get("epstein_is_sender", 0),
                row.get("is_promotional", 0),
                row["all_participants"],
                row["body"],
            ),
        )
        existing_ids.add(email_id)
        inserted += 1
        if inserted % 1000 == 0:
            conn.commit()
            print(f"  ... {inserted} rows inserted", flush=True)
    conn.commit()
    conn.close()
    return inserted


def rebuild_fts(db_path):
    """Rebuild the FTS5 index."""
    conn = sqlite3.connect(str(db_path))
    conn.execute("INSERT INTO emails_fts(emails_fts) VALUES('rebuild')")
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Parquet loading and row preparation
# ---------------------------------------------------------------------------
def load_parquet():
    """Load the full parquet and return a DataFrame."""
    print(f"Loading {FULL_PARQUET} ...", flush=True)
    df = pd.read_parquet(str(FULL_PARQUET))
    print(f"  {len(df):,} rows loaded", flush=True)
    return df


def prepare_row(parquet_row, idx):
    """Convert a parquet row dict into a DB-ready dict with country tags."""
    doc_id = str(parquet_row.get("doc_id", ""))
    body = str(parquet_row.get("content_markdown", "") or "")
    sender = str(parquet_row.get("sender", "") or "")
    subject = str(parquet_row.get("subject", "") or "")
    to_recipients = str(parquet_row.get("to_recipients", "") or "")
    all_participants = str(parquet_row.get("all_participants", "") or "")
    sent_at = str(parquet_row.get("sent_at", "") or "")
    release_batch = parquet_row.get("release_batch")
    epstein_is_sender = int(parquet_row.get("epstein_is_sender", 0) or 0)
    is_promotional = int(parquet_row.get("is_promotional", 0) or 0)

    # Build email ID: doc_id-index
    email_id = f"{doc_id}-{idx}"

    # Country auto-tagging
    combined = " ".join([
        re.sub(r"<[^>]+>", " ", subject),
        sender, all_participants, body,
    ])
    countries = detect_countries(combined)

    return {
        "id": email_id,
        "doc_id": doc_id,
        "sender": sender,
        "subject": subject,
        "to_recipients": to_recipients,
        "sent_at": sent_at,
        "countries": countries,
        "release_batch": release_batch,
        "epstein_is_sender": epstein_is_sender,
        "is_promotional": is_promotional,
        "all_participants": all_participants,
        "body": body,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Ingest Africa emails from parquet")
    parser.add_argument("--tier1", action="store_true", help="Ingest Tier 1 into production DB")
    parser.add_argument("--research", action="store_true", help="Build research DB (all tiers)")
    parser.add_argument("--dry-run", action="store_true", help="Count only, no writes")
    args = parser.parse_args()

    if not args.tier1 and not args.research:
        parser.error("Specify --tier1 and/or --research")

    if not FULL_PARQUET.exists():
        print(f"ERROR: {FULL_PARQUET} not found")
        sys.exit(1)

    df = load_parquet()

    # Pre-compute text columns as strings for filtering
    df["_body"] = df["content_markdown"].fillna("").astype(str)
    df["_sender"] = df["sender"].fillna("").astype(str)
    df["_recip"] = df["to_recipients"].fillna("").astype(str)
    df["_subj"] = df["subject"].fillna("").astype(str)
    df["_all"] = df["all_participants"].fillna("").astype(str)
    df["_promo"] = df["is_promotional"].fillna(0).astype(int)
    df["_epstein"] = df["epstein_is_sender"].fillna(0).astype(int)

    # Combine text for filtering
    df["_combined"] = df["_subj"] + " " + df["_sender"] + " " + df["_all"] + " " + df["_body"]

    # --------------- Tier 1: Non-promo, Epstein involved, Africa geo in body ---------------
    print("\nApplying filters ...", flush=True)

    geo_in_body = df["_body"].str.contains(_GEO_RE, na=False)
    geo_or_person_any = df["_combined"].str.contains(_GEO_RE, na=False) | df["_combined"].str.contains(_PERSON_RE, na=False)
    non_promo = df["_promo"] == 0

    # Epstein involved = sender OR in all_participants
    epstein_involved = (df["_epstein"] == 1) | df["_all"].str.contains("epstein|jeevacation", case=False, na=False)

    tier1_mask = non_promo & epstein_involved & geo_in_body
    tier2_mask = non_promo & geo_in_body & ~tier1_mask
    tier3_mask = geo_or_person_any & ~tier1_mask & ~tier2_mask

    tier1_df = df[tier1_mask]
    tier2_df = df[tier2_mask]
    tier3_df = df[tier3_mask]
    all_tiers_df = df[tier1_mask | tier2_mask | tier3_mask]

    print(f"  Tier 1 (high):   {len(tier1_df):,} rows ({tier1_df['doc_id'].nunique():,} unique doc_ids)")
    print(f"  Tier 2 (medium): {len(tier2_df):,} rows ({tier2_df['doc_id'].nunique():,} unique doc_ids)")
    print(f"  Tier 3 (low):    {len(tier3_df):,} rows ({tier3_df['doc_id'].nunique():,} unique doc_ids)")
    print(f"  All tiers:       {len(all_tiers_df):,} rows ({all_tiers_df['doc_id'].nunique():,} unique doc_ids)")

    if args.dry_run:
        print("\n[DRY RUN] No writes performed.")
        return

    # --------------- Ingest Tier 1 into production DB ---------------
    if args.tier1:
        print(f"\n=== Ingesting Tier 1 into {PROD_DB} ===", flush=True)
        existing = get_existing_ids(PROD_DB)
        print(f"  Existing rows in DB: {len(existing):,}")

        # Group by doc_id and assign indices
        rows_to_insert = []
        for doc_id, group in tier1_df.groupby("doc_id"):
            # Check how many rows with this doc_id already exist
            existing_count = sum(1 for eid in existing if eid.rsplit("-", 1)[0] == doc_id)
            for i, (_, parquet_row) in enumerate(group.iterrows()):
                row = prepare_row(parquet_row, existing_count + i)
                if row["id"] not in existing:
                    rows_to_insert.append(row)

        print(f"  New rows to insert: {len(rows_to_insert):,}")
        inserted = insert_rows(PROD_DB, rows_to_insert, existing)
        print(f"  Inserted: {inserted:,}")

        print("  Rebuilding FTS index ...", flush=True)
        rebuild_fts(PROD_DB)
        print("  Done.")

        db_size = PROD_DB.stat().st_size / (1024 * 1024)
        print(f"  DB size: {db_size:.1f} MB")

    # --------------- Build research DB (all tiers) ---------------
    if args.research:
        print(f"\n=== Building research DB at {RESEARCH_DB} ===", flush=True)
        init_db(RESEARCH_DB)
        existing = get_existing_ids(RESEARCH_DB)
        print(f"  Existing rows in research DB: {len(existing):,}")

        rows_to_insert = []
        for doc_id, group in all_tiers_df.groupby("doc_id"):
            existing_count = sum(1 for eid in existing if eid.rsplit("-", 1)[0] == doc_id)
            for i, (_, parquet_row) in enumerate(group.iterrows()):
                row = prepare_row(parquet_row, existing_count + i)
                if row["id"] not in existing:
                    rows_to_insert.append(row)

        print(f"  New rows to insert: {len(rows_to_insert):,}")
        inserted = insert_rows(RESEARCH_DB, rows_to_insert, existing)
        print(f"  Inserted: {inserted:,}")

        print("  Rebuilding FTS index ...", flush=True)
        rebuild_fts(RESEARCH_DB)
        print("  Done.")

        db_size = RESEARCH_DB.stat().st_size / (1024 * 1024)
        print(f"  Research DB size: {db_size:.1f} MB")


if __name__ == "__main__":
    main()
