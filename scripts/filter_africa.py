"""
Filter emails-slim.parquet down to Africa-relevant emails.
Run from project root: python3 scripts/filter_africa.py

Reads 1.78M emails, applies Africa keyword filter on metadata
(subject + sender + all_participants), writes data/jmail/africa.parquet.
"""

import re
from pathlib import Path

import pandas as pd

SLIM_PARQUET = Path("data/jmail/emails-slim.parquet")
OUT_PARQUET = Path("data/jmail/africa.parquet")

# All terms that signal Africa relevance. Value = canonical country tag (for
# the country-detection pass in build_db.py); here we just need a hit/no-hit.
AFRICA_KEYWORDS = [
    # Generic
    "africa", "african",
    # East Africa
    "kenya", "nairobi", "mombasa",
    "tanzania", "dar es salaam",
    "ethiopia", "addis ababa",
    "rwanda", "kigali",
    "uganda", "kampala",
    "somalia", "somaliland", "mogadishu",
    # West Africa
    "nigeria", "lagos", "abuja", "dangote",
    "ghana", "accra",
    "ivory coast", "côte d'ivoire", "cote d'ivoire", "abidjan",
    "senegal", "dakar", "karim wade",
    "mali", "bamako", "mansa musa",
    "cameroon", "yaounde", "douala",
    "liberia",
    "sierra leone", "freetown",
    # Central Africa
    "congo", "kinshasa", "kabila", "brazzaville",
    "gabon", "libreville",
    "angola", "luanda",
    # Southern Africa
    "south africa", "cape town", "johannesburg", "durban", "joburg",
    "sol kerzner", "kerzner", "sun city",
    "africadevelop",
    "zimbabwe", "harare", "mugabe",
    "mozambique", "maputo",
    "zambia", "lusaka",
    "botswana", "gaborone",
    "madagascar",
    # North Africa
    "morocco", "marrakech", "rabat",
    "egypt", "cairo", "alexandria",
    "sudan", "khartoum",
    "libya", "tripoli",
    "tunisia", "tunis",
    # Indian Ocean / islands
    "mauritius", "seychelles",
    # People / orgs with Africa ties
    "nasra hassan",
    "sidi",
]

_PATTERNS = [
    re.compile(r'\b' + re.escape(kw) + r'\b', re.IGNORECASE)
    for kw in AFRICA_KEYWORDS
]

_HTML_TAG = re.compile(r'<[^>]+>')


def is_africa_relevant(row) -> bool:
    text = " ".join(filter(None, [
        _HTML_TAG.sub(" ", str(row.get("subject") or "")),
        str(row.get("sender") or ""),
        str(row.get("all_participants") or ""),
    ]))
    return any(p.search(text) for p in _PATTERNS)


def main():
    print(f"Reading {SLIM_PARQUET} ...")
    df = pd.read_parquet(SLIM_PARQUET)
    print(f"  Total emails: {len(df):,}")

    # Remove promotional
    before = len(df)
    df = df[~df["is_promotional"].fillna(False).astype(bool)]
    print(f"  After removing promotional: {len(df):,} (removed {before - len(df):,})")

    print("  Filtering for Africa relevance ...")
    mask = df.apply(is_africa_relevant, axis=1)
    africa = df[mask].copy()
    print(f"  Africa-relevant: {len(africa):,} (from {before:,} total)")

    africa.to_parquet(OUT_PARQUET, index=False)
    print(f"  Written → {OUT_PARQUET}")


if __name__ == "__main__":
    main()
