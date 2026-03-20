"""
Build SQLite database from africa.parquet.
Run from project root: python3 scripts/build_db.py
"""

import sqlite3
import json
import re
from pathlib import Path

import pandas as pd

_HTML_TAG = re.compile(r'<[^>]+'+'>')

PARQUET = Path("data/jmail/africa.parquet")
DB_PATH = Path("web/data/epstein_africa.db")

# Map of lowercase keywords → canonical country name
COUNTRY_KEYWORDS = {
    "kenya": "Kenya",
    "nairobi": "Kenya",
    "mombasa": "Kenya",
    "nigeria": "Nigeria",
    "lagos": "Nigeria",
    "abuja": "Nigeria",
    "ivory coast": "Ivory Coast",
    "côte d'ivoire": "Ivory Coast",
    "cote d'ivoire": "Ivory Coast",
    "abidjan": "Ivory Coast",
    "south africa": "South Africa",
    "cape town": "South Africa",
    "johannesburg": "South Africa",
    "durban": "South Africa",
    "joburg": "South Africa",
    "senegal": "Senegal",
    "dakar": "Senegal",
    "zimbabwe": "Zimbabwe",
    "harare": "Zimbabwe",
    "mugabe": "Zimbabwe",
    "somalia": "Somalia",
    "somaliland": "Somalia",
    "mogadishu": "Somalia",
    "ethiopia": "Ethiopia",
    "addis ababa": "Ethiopia",
    "tanzania": "Tanzania",
    "dar es salaam": "Tanzania",
    "ghana": "Ghana",
    "accra": "Ghana",
    "morocco": "Morocco",
    "marrakech": "Morocco",
    "rabat": "Morocco",
    "rwanda": "Rwanda",
    "kigali": "Rwanda",
    "uganda": "Uganda",
    "kampala": "Uganda",
    "egypt": "Egypt",
    "cairo": "Egypt",
    "alexandria": "Egypt",
    "liberia": "Liberia",
    "sierra leone": "Sierra Leone",
    "freetown": "Sierra Leone",
    "sudan": "Sudan",
    "khartoum": "Sudan",
    "congo": "Congo",
    "kinshasa": "Congo",
    "congo kinshasa": "Congo",
    "kabila": "Congo",
    "brazzaville": "Congo",
    "gabon": "Gabon",
    "libreville": "Gabon",
    "madagascar": "Madagascar",
    "mozambique": "Mozambique",
    "maputo": "Mozambique",
    "zambia": "Zambia",
    "lusaka": "Zambia",
    "botswana": "Botswana",
    "gaborone": "Botswana",
    "cameroon": "Cameroon",
    "angola": "Angola",
    "luanda": "Angola",
    "mauritius": "Mauritius",
    "seychelles": "Seychelles",
    "mali": "Mali",
    "bamako": "Mali",
    "mansa musa": "Mali",
    "libya": "Libya",
    "tripoli": "Libya",
    "tunisia": "Tunisia",
    "tunis": "Tunisia",
    "africa": "Africa",
    "dangote": "Nigeria",
    "sol kerzner": "South Africa",
    "kerzner": "South Africa",
    "sun city": "South Africa",
    "africadevelop": "South Africa",
    "karim wade": "Senegal",
}

# Compile word-boundary patterns for each keyword
_PATTERNS = [
    (re.compile(r'\b' + re.escape(kw) + r'\b', re.IGNORECASE), country)
    for kw, country in COUNTRY_KEYWORDS.items()
]


def detect_countries(text: str) -> str:
    """Return comma-separated unique country names found in text."""
    if not text:
        return ""
    seen: dict[str, bool] = {}
    for pattern, country in _PATTERNS:
        if pattern.search(text):
            seen[country] = True
    return ", ".join(seen.keys())


def main():
    print(f"Reading {PARQUET} ...")
    df = pd.read_parquet(PARQUET)
    print(f"  {len(df)} rows, {df['id'].nunique()} unique ids")

    # Build search text: strip HTML, then join subject + sender + participants + body
    def combined(row):
        parts = [
            _HTML_TAG.sub(" ", str(row.get("subject") or "")),
            str(row.get("sender") or ""),
            str(row.get("all_participants") or ""),
            str(row.get("body") or "") if "body" in row else "",
        ]
        return " ".join(parts)

    df["countries"] = df.apply(lambda r: detect_countries(combined(r)), axis=1)

    # Normalise to_recipients to plain string
    def flatten(val):
        if isinstance(val, list):
            return ", ".join(str(v) for v in val)
        return str(val) if val is not None else ""

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.executescript("""
        CREATE TABLE emails (
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
            all_participants  TEXT
        );
        CREATE INDEX idx_sent_at  ON emails(sent_at);
        CREATE INDEX idx_sender   ON emails(sender);
    """)

    rows = []
    for _, r in df.iterrows():
        rows.append((
            r["id"],
            r.get("doc_id"),
            r.get("sender"),
            r.get("subject"),
            flatten(r.get("to_recipients")),
            r.get("sent_at"),
            r.get("countries", ""),
            r.get("release_batch"),
            int(bool(r.get("epstein_is_sender"))),
            int(bool(r.get("is_promotional"))),
            r.get("all_participants"),
        ))

    cur.executemany(
        "INSERT INTO emails VALUES (?,?,?,?,?,?,?,?,?,?,?)", rows
    )
    conn.commit()
    conn.close()

    print(f"  Written {len(rows)} rows → {DB_PATH}")
    countries_found = df["countries"].str.split(", ").explode().value_counts()
    print("\nCountry breakdown:")
    print(countries_found.to_string())


if __name__ == "__main__":
    main()
