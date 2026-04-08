#!/usr/bin/env python3
"""
lead_discovery_structural.py — 6-algorithm structural pass on research.db + parquet.

Surfaces unexplored leads beyond entity-centric search.
Output: output/lead-discovery-structural.md
"""

import sqlite3
import re
from pathlib import Path
from collections import defaultdict, Counter
from datetime import datetime, timedelta

import pandas as pd
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parent.parent
RES_DB = ROOT / "web" / "data" / "research.db"
PROD_DB = ROOT / "web" / "data" / "epstein_africa.db"
PARQUET_FULL = ROOT / "data" / "jmail" / "emails-full.parquet"
PARQUET_AFRICA = ROOT / "data" / "jmail" / "africa.parquet"
OUT = ROOT / "output" / "lead-discovery-structural.md"

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PROFILED = [
    "sultan", "wade", "nikolic", "rod-larsen", "groff", "ito", "siegal",
    "zeitlin", "barak", "mandelson", "lloyd", "siad", "kerzner", "shaher",
    "abdulhak", "trivers", "chomsky", "bannon", "stern", "staley", "maxwell",
    "ghislaine", "brunel", "visoski", "goertzel", "chopra", "jabor",
    "farkas", "summers", "gates", "richardson", "epstein", "jeevacation",
    "jeeproject", "jeffrey e", "boris", "rothschild", "feliho", "keita",
    "junkermann", "shuliak", "pritzker", "crowe", "lang", "siad",
    "svensson", "jagland", "leon black", "leonblack",
]

PUBLISHED_COUNTRIES = {
    "Kenya", "Nigeria", "Ivory Coast", "South Africa", "Senegal", "Zimbabwe",
    "Somalia", "Ethiopia", "Tanzania", "Ghana", "Rwanda", "Gabon", "Sudan",
    "Djibouti", "Libya", "Morocco", "Angola", "Mozambique", "Cameroon",
    "Egypt", "Congo", "Yemen",
}

AFRICA_KEYWORDS = [
    "africa", "kenya", "nigeria", "senegal", "ghana", "angola", "ethiopia",
    "somalia", "zimbabwe", "rwanda", "sudan", "djibouti", "libya", "morocco",
    "gabon", "ivory coast", "côte d'ivoire", "south africa", "mozambique",
    "cameroon", "egypt", "congo", "tanzania", "tunisia", "algeria", "mali",
    "burkina", "niger ", "namibia", "botswana", "zambia", "uganda",
    "madagascar", "mauritius", "seychelles", "comoros", "lesotho", "eswatini",
    "swaziland", "malawi", "guinea", "liberia", "sierra leone", "togo",
    "benin", "central african", "chad", "eritrea", "south sudan",
    "western sahara", "mauritania", "cape verde",
]

def is_profiled(s):
    if not s:
        return False
    sl = s.lower()
    return any(p in sl for p in PROFILED)

def has_africa(text):
    if not text:
        return False
    tl = text.lower()
    return any(k in tl for k in AFRICA_KEYWORDS)

def short(s, n=120):
    if s is None:
        return ""
    if isinstance(s, float):
        return ""
    s = str(s)
    if not s or s == "nan":
        return ""
    return s.replace("\n", " ").replace("\r", " ")[:n]

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

print("Connecting to DBs...")
res = sqlite3.connect(str(RES_DB))
prod = sqlite3.connect(str(PROD_DB))
prod_docids = {r[0] for r in prod.execute("SELECT DISTINCT doc_id FROM emails")}
print(f"  research.db rows: {res.execute('SELECT COUNT(*) FROM emails').fetchone()[0]}")
print(f"  production doc_ids: {len(prod_docids)}")

# Body-content fingerprint check.
#
# The naive "research-only" filter (`doc_id NOT IN prod_docids`) misses the
# case where the SAME content lives in PROD under a different doc_id sibling.
# Most "needs ingest" leads from earlier passes turned out to be redundant
# because their content was already in PROD via a different doc_id.
#
# Fingerprint = WORD-based 12-gram shingles, OCR-tolerant. The original
# char-window fingerprint missed cases where OCR-broken chars (e.g.
# "publ=c" vs "pu=lic" vs "public") shifted the byte position of the
# slice. Word-shingle fingerprints survive single-character OCR breaks
# because individual broken chars become extra "words" but the 12-gram
# context is preserved 11/12 times within each window.

def content_fingerprints(body):
    """Yields a set of word-shingle fingerprints for `body`. OCR-tolerant.
    Returns empty set if the body is too short to fingerprint."""
    if not body or len(body) < 50:
        return frozenset()
    # Aggressive normalization: strip MIME `=XX` artifacts AND lone `=`
    # before tokenizing, since OCR can mangle either form.
    norm = re.sub(r"=[0-9a-f]{2}", "", body, flags=re.IGNORECASE)
    norm = re.sub(r"=", "", norm)
    norm = re.sub(r"[^a-z0-9 ]", " ", norm.lower())
    words = norm.split()
    if len(words) < 12:
        return frozenset()
    # Build a set of 12-gram word shingles. Stride by 4 to keep the set
    # small but still robust to single-word OCR breaks.
    shingles = set()
    for i in range(0, len(words) - 11, 4):
        shingles.add(" ".join(words[i:i+12]))
    return frozenset(shingles)

print("  building PROD content fingerprints (word shingles)...")
prod_fingerprints = set()
for r in prod.execute("SELECT body FROM emails WHERE body IS NOT NULL"):
    for fp in content_fingerprints(r[0]):
        prod_fingerprints.add(fp)
print(f"  PROD shingle fingerprints: {len(prod_fingerprints)}")

def content_already_in_prod(body):
    """True if ANY shingle of `body` matches any PROD shingle."""
    fps = content_fingerprints(body)
    return any(fp in prod_fingerprints for fp in fps)

# Pre-compute the set of research doc_ids whose body content is already in
# PROD via a sibling doc_id. Algorithms 2/3/5 use this alongside prod_docids
# to reject content-redundant "gap" candidates.
print("  scanning research bodies for content already in PROD...")
research_redundant_docids = set()
for row in res.execute("SELECT doc_id, body FROM emails WHERE body IS NOT NULL"):
    if row[0] not in prod_docids and content_already_in_prod(row[1]):
        research_redundant_docids.add(row[0])
print(f"  research doc_ids redundant with PROD via sibling content: {len(research_redundant_docids)}")

def is_research_only(doc_id):
    """A doc_id is genuinely research-only if it's not in PROD AND not
    content-redundant with a PROD sibling."""
    return doc_id not in prod_docids and doc_id not in research_redundant_docids

sections = {}

# ---------------------------------------------------------------------------
# Algorithm 1 — Burst detection
# ---------------------------------------------------------------------------

print("\n[1/6] Burst detection...")

# Pull rows with valid date (skip 1990-01-01 placeholder)
rows = res.execute("""
    SELECT doc_id, sender, sent_at, subject, countries, substr(body,1,200)
    FROM emails
    WHERE sent_at IS NOT NULL
      AND sent_at != ''
      AND sent_at NOT LIKE '1990-%'
      AND sent_at NOT LIKE 'nan%'
""").fetchall()

# Group by date (YYYY-MM-DD)
by_date = defaultdict(list)
for r in rows:
    day = (r[2] or "")[:10]
    if len(day) == 10 and day[4] == "-":
        by_date[day].append(r)

dates_sorted = sorted(by_date.keys())
date_objs = []
for d in dates_sorted:
    try:
        date_objs.append(datetime.strptime(d, "%Y-%m-%d"))
    except ValueError:
        pass

# 3-day rolling window: for each date, sum count of self + next 2 days
day_counts = {d: len(by_date[d]) for d in dates_sorted}
bursts = []
for i, d in enumerate(dates_sorted):
    try:
        d0 = datetime.strptime(d, "%Y-%m-%d")
    except ValueError:
        continue
    window = [d]
    for j in range(i+1, len(dates_sorted)):
        try:
            dj = datetime.strptime(dates_sorted[j], "%Y-%m-%d")
        except ValueError:
            continue
        if (dj - d0).days <= 2:
            window.append(dates_sorted[j])
        else:
            break
    total = sum(day_counts[w] for w in window)
    if total >= 5:
        # Collect all rows in window
        rs = []
        for w in window:
            rs.extend(by_date[w])
        # Filter to bursts where most senders are NOT profiled
        unprofiled = [r for r in rs if not is_profiled(r[1])]
        if len(unprofiled) >= 3:
            bursts.append({
                "date_start": d,
                "date_end": window[-1],
                "total": total,
                "unprofiled_count": len(unprofiled),
                "rows": rs,
            })

# Dedupe overlapping bursts: keep only bursts where date_start advances by 3+ days
bursts.sort(key=lambda b: b["date_start"])
deduped = []
last_end = None
for b in bursts:
    if last_end is None or b["date_start"] > last_end:
        deduped.append(b)
        last_end = b["date_end"]

# Rank by (unprofiled count, africa tag presence)
def burst_score(b):
    africa_count = sum(1 for r in b["rows"] if r[4] and any(c in (r[4] or "") for c in PUBLISHED_COUNTRIES))
    return (africa_count, b["unprofiled_count"])

deduped.sort(key=burst_score, reverse=True)

print(f"  found {len(deduped)} distinct bursts (3+ unprofiled, 5+ total)")

lines = ["## Algorithm 1: Burst Detection\n",
         f"Distinct bursts (5+ emails / 3-day window, 3+ unprofiled senders): **{len(deduped)}**\n"]
for b in deduped[:25]:
    africa_marker = ""
    africa_rows = [r for r in b["rows"] if r[4] and any(c in (r[4] or "") for c in PUBLISHED_COUNTRIES)]
    if africa_rows:
        africa_marker = f" [AFRICA: {', '.join(set(r[4] for r in africa_rows if r[4]))[:60]}]"
    senders = sorted(set((r[1] or "") for r in b["rows"]))
    subjects = [r[3] for r in b["rows"] if r[3]]
    lines.append(f"### {b['date_start']} → {b['date_end']} — {b['total']} emails ({b['unprofiled_count']} unprofiled){africa_marker}")
    lines.append(f"  - senders: {', '.join(short(s, 30) for s in senders[:8])}")
    lines.append(f"  - subjects: {' | '.join(short(s, 40) for s in subjects[:5])}")
    sample_docs = [r[0] for r in b["rows"][:5]]
    lines.append(f"  - sample doc_ids: {', '.join(sample_docs)}")
    lines.append("")
sections["alg1"] = "\n".join(lines)

# ---------------------------------------------------------------------------
# Algorithm 2 — Country gap
# ---------------------------------------------------------------------------

print("\n[2/6] Country gap analysis...")

# Distinct countries in research.db
country_rows = res.execute("""
    SELECT countries, COUNT(*) as n
    FROM emails
    WHERE countries IS NOT NULL AND countries != '' AND countries != 'nan'
    GROUP BY countries
""").fetchall()

# Split country tag strings (some are CSV)
country_counts = Counter()
country_emails = defaultdict(list)
all_rows_with_country = res.execute("""
    SELECT doc_id, sender, sent_at, subject, countries
    FROM emails
    WHERE countries IS NOT NULL AND countries != '' AND countries != 'nan'
""").fetchall()
for r in all_rows_with_country:
    cs = re.split(r"[,;|]", r[4])
    for c in cs:
        c = c.strip()
        if c:
            country_counts[c] += 1
            country_emails[c].append(r)

# Countries NOT in published list
unpublished = {c: n for c, n in country_counts.items() if c not in PUBLISHED_COUNTRIES}
sorted_unpub = sorted(unpublished.items(), key=lambda x: -x[1])

lines = ["## Algorithm 2: Country Gap\n",
         f"Distinct country tags in research.db: **{len(country_counts)}**\n",
         f"Unpublished countries (no story yet): **{len(unpublished)}**\n"]

lines.append("### Unpublished countries (ranked by email count)\n")
for c, n in sorted_unpub[:20]:
    rs = country_emails[c]
    senders = sorted(set((r[1] or "") for r in rs if r[1]))
    dates = [r[2] for r in rs if r[2] and not r[2].startswith("1990") and not r[2].startswith("nan")]
    date_range = f"{min(dates)[:10]} → {max(dates)[:10]}" if dates else "n/a"
    sample_subj = [r[3] for r in rs[:3] if r[3]]
    sample_docs = [r[0] for r in rs[:5]]
    lines.append(f"#### {c} — {n} emails")
    lines.append(f"  - top senders: {', '.join(short(s, 30) for s in senders[:5])}")
    lines.append(f"  - dates: {date_range}")
    lines.append(f"  - subjects: {' | '.join(short(s, 50) for s in sample_subj)}")
    lines.append(f"  - sample doc_ids: {', '.join(sample_docs)}")
    lines.append("")

# Within published countries: rows in research not in production
lines.append("\n### Published countries — research-only gap rows\n")
for c in sorted(PUBLISHED_COUNTRIES):
    if c not in country_emails:
        continue
    rs = country_emails[c]
    gap = [r for r in rs if is_research_only(r[0])]
    redundant_count = sum(1 for r in rs if r[0] not in prod_docids and r[0] in research_redundant_docids)
    if not gap:
        continue
    senders = sorted(set((r[1] or "") for r in gap if r[1]))
    sample_docs = [r[0] for r in gap[:5]]
    sample_subj = [r[3] for r in gap[:3] if r[3]]
    redundant_note = f" [+ {redundant_count} content-redundant with PROD]" if redundant_count else ""
    lines.append(f"- **{c}** — {len(gap)} research-only emails (of {len(rs)} total){redundant_note}")
    lines.append(f"    senders: {', '.join(short(s, 25) for s in senders[:5])}")
    if sample_subj:
        lines.append(f"    subjects: {' | '.join(short(s, 50) for s in sample_subj)}")
    lines.append(f"    docs: {', '.join(sample_docs)}")
    lines.append("")
sections["alg2"] = "\n".join(lines)
print(f"  unpublished countries: {len(unpublished)}")
print(f"  published-country gap rows (genuine, after content-redundancy filter): {sum(1 for c in PUBLISHED_COUNTRIES if c in country_emails for r in country_emails[c] if is_research_only(r[0]))}")

# ---------------------------------------------------------------------------
# Algorithm 3 — Forward chain analysis
# ---------------------------------------------------------------------------

print("\n[3/6] Forward chain analysis...")

fwd_rows = res.execute("""
    SELECT doc_id, sender, sent_at, subject, countries, body
    FROM emails
    WHERE (body LIKE '%FW:%' OR body LIKE '%Fwd:%' OR body LIKE '%forwarded message%' OR subject LIKE 'Fw%' OR subject LIKE 'FW%')
      AND lower(sender) NOT LIKE '%groff%'
      AND sent_at IS NOT NULL
      AND sent_at NOT LIKE '1990%'
      AND sent_at NOT LIKE 'nan%'
""").fetchall()

# Bucket by content type heuristic
def classify_fwd(body):
    if not body:
        return "unknown"
    bl = body.lower()
    if any(k in bl for k in ["http://", "https://", "nytimes", "reuters", "bloomberg", "ft.com", "wsj", "guardian"]):
        return "news_article"
    if any(k in bl for k in ["intelligence", "source", "confidential", "classified"]):
        return "intel"
    if any(k in bl for k in ["introduce", "meet", "you should", "you may want", "fyi"]):
        return "intro_or_fyi"
    if any(k in bl for k in ["wire", "transfer", "invoice", "payment", "swift", "iban"]):
        return "financial"
    return "other"

buckets = defaultdict(list)
gap_fwds = [r for r in fwd_rows if is_research_only(r[0])]
for r in gap_fwds:
    buckets[classify_fwd(r[5])].append(r)

lines = ["## Algorithm 3: Forward Chains\n",
         f"Total forward emails (research.db, not from Groff): **{len(fwd_rows)}**\n",
         f"Research-only gap rows: **{len(gap_fwds)}**\n"]

for bucket in ["intel", "financial", "intro_or_fyi", "news_article", "other"]:
    rs = buckets[bucket]
    if not rs:
        continue
    lines.append(f"\n### {bucket} — {len(rs)} emails")
    # Pick high-value: africa keyword in body or subject
    africa_relevant = [r for r in rs if has_africa((r[3] or "") + " " + (r[5] or "")[:500])]
    others = [r for r in rs if r not in africa_relevant]
    show = africa_relevant[:8] + others[:5]
    for r in show:
        marker = "[AFRICA] " if r in africa_relevant else ""
        lines.append(f"  - {marker}`{r[0]}` | {(r[1] or '')[:25]} | {(r[2] or '')[:10]} | {short(r[3], 60)}")
        lines.append(f"    {short(r[5], 200)}")
        lines.append("")
sections["alg3"] = "\n".join(lines)
print(f"  total fwds: {len(fwd_rows)}, gap: {len(gap_fwds)}")

# ---------------------------------------------------------------------------
# Algorithm 4 — Single-contact extraction (parquet)
# ---------------------------------------------------------------------------

print("\n[4/6] Single-contact extraction from full parquet (this is heavy)...")

# Read only the columns we need
cols = ["doc_id", "sender", "subject", "sent_at", "all_participants",
        "epstein_is_sender", "content_markdown"]
print("  loading parquet (1.78M rows)...")
df = pd.read_parquet(PARQUET_FULL, columns=cols)
print(f"  loaded: {len(df)} rows")

# Filter: epstein_is_sender = False, sender is non-empty
df = df[df["epstein_is_sender"] == False]
df = df[df["sender"].notna() & (df["sender"] != "")]

# all_participants must contain epstein
df["ap_low"] = df["all_participants"].fillna("").str.lower()
df = df[df["ap_low"].str.contains("epstein", na=False)]
print(f"  after filter (non-Epstein sender, Epstein in participants): {len(df)}")

# Sender frequency
sender_counts = df["sender"].value_counts()
rare_senders = sender_counts[(sender_counts >= 1) & (sender_counts <= 3)].index
print(f"  rare senders (1-3 occurrences): {len(rare_senders)}")

rare_df = df[df["sender"].isin(rare_senders)].copy()
print(f"  rare-sender emails: {len(rare_df)}")

# Filter out profiled senders
def sender_is_profiled(s):
    if not s:
        return False
    sl = s.lower()
    return any(p in sl for p in PROFILED)

rare_df["profiled"] = rare_df["sender"].apply(sender_is_profiled)
rare_df = rare_df[~rare_df["profiled"]]
print(f"  after profiled filter: {len(rare_df)}")

# Africa relevance
def safe(v):
    if v is None:
        return ""
    if isinstance(v, float):
        return ""
    return str(v)

def row_africa(row):
    txt = (safe(row.get("subject")) + " " + safe(row.get("content_markdown"))[:500]).lower()
    return any(k in txt for k in AFRICA_KEYWORDS)

rare_df["africa"] = rare_df.apply(row_africa, axis=1)
africa_rare = rare_df[rare_df["africa"]].copy()
print(f"  africa-relevant: {len(africa_rare)}")

# Sort: africa first, then alphabetical sender
lines = ["## Algorithm 4: Single-Contact Asks (full parquet)\n",
         f"Senders appearing 1-3 times total in 1.78M-row parquet: **{len(rare_senders)}**\n",
         f"Rare-sender emails to Epstein (not profiled): **{len(rare_df)}**\n",
         f"Africa-relevant: **{len(africa_rare)}**\n"]

lines.append("### Africa-relevant single-contact asks\n")
shown = africa_rare.head(30)
for _, row in shown.iterrows():
    body = (row.get("content_markdown") or "")[:300].replace("\n", " ").replace("\r", " ")
    lines.append(f"- `{row['doc_id']}` | **{short(row['sender'], 35)}** | {short(str(row.get('sent_at') or ''), 10)}")
    lines.append(f"  subject: {short(row.get('subject') or '', 80)}")
    lines.append(f"  {body}")
    lines.append("")

# Also: top non-Africa rare senders that look interesting (long body, not generic)
lines.append("\n### High-substance non-Africa single-contact asks (top 15)\n")
non_africa = rare_df[~rare_df["africa"]].copy()
non_africa["body_len"] = non_africa["content_markdown"].fillna("").str.len()
non_africa = non_africa[non_africa["body_len"].between(200, 5000)]
non_africa = non_africa.sort_values("body_len", ascending=False).head(15)
for _, row in non_africa.iterrows():
    body = (row.get("content_markdown") or "")[:250].replace("\n", " ").replace("\r", " ")
    lines.append(f"- `{row['doc_id']}` | {short(row['sender'], 35)} | {short(str(row.get('sent_at') or ''), 10)}")
    lines.append(f"  subject: {short(row.get('subject') or '', 80)}")
    lines.append(f"  {body}")
    lines.append("")

sections["alg4"] = "\n".join(lines)

# Save Algorithm 4 leads for later cross-ranking
algo4_africa_leads = africa_rare.to_dict("records")

del df, rare_df  # free memory

# ---------------------------------------------------------------------------
# Algorithm 5 — Lesley Groff as operational proxy
# ---------------------------------------------------------------------------

print("\n[5/6] Groff operational proxy...")

groff_rows = res.execute("""
    SELECT doc_id, sender, sent_at, subject, countries, body
    FROM emails
    WHERE lower(sender) LIKE '%groff%'
       OR lower(body) LIKE '%lesley will pay%'
       OR lower(body) LIKE '%lesley book%'
       OR lower(body) LIKE '%lesley arrange%'
       OR lower(body) LIKE '%lesley will send%'
       OR lower(body) LIKE '%groff to pay%'
       OR lower(body) LIKE '%groff will%'
""").fetchall()

print(f"  total Groff-tagged rows: {len(groff_rows)}")
gap_groff = [r for r in groff_rows if is_research_only(r[0])]
print(f"  research-only gap: {len(gap_groff)}")

# Africa relevance
africa_groff = [r for r in gap_groff if has_africa((r[3] or "") + " " + (r[5] or "")[:500])]

lines = ["## Algorithm 5: Groff Operational Proxy\n",
         f"Total Groff-tagged rows in research.db: **{len(groff_rows)}**\n",
         f"Research-only gap rows: **{len(gap_groff)}**\n",
         f"Africa-relevant gap rows: **{len(africa_groff)}**\n"]

lines.append("### Africa-relevant Groff operations (research-only)\n")
for r in africa_groff[:30]:
    lines.append(f"- `{r[0]}` | {(r[1] or '')[:25]} | {(r[2] or '')[:10]}")
    lines.append(f"  subject: {short(r[3] or '', 80)}  | countries: {(r[4] or '')[:40]}")
    lines.append(f"  {short(r[5], 350)}")
    lines.append("")

# Non-Africa interesting ones — look for resource commitments to people not in PROFILED
lines.append("\n### Non-Africa Groff resource commitments (top 15 by body length)\n")
non_africa_groff = [r for r in gap_groff if r not in africa_groff]
non_africa_groff.sort(key=lambda r: -(len(r[5] or "")))
for r in non_africa_groff[:15]:
    body = r[5] or ""
    if len(body) < 100 or len(body) > 4000:
        continue
    lines.append(f"- `{r[0]}` | {(r[1] or '')[:25]} | {(r[2] or '')[:10]}")
    lines.append(f"  subject: {short(r[3] or '', 80)}")
    lines.append(f"  {short(body, 300)}")
    lines.append("")

sections["alg5"] = "\n".join(lines)

# ---------------------------------------------------------------------------
# Algorithm 6 — Participant pair novelty (parquet)
# ---------------------------------------------------------------------------

print("\n[6/6] Participant-pair novelty (Africa parquet first; then full parquet for Epstein-pair filter)...")

# Use africa.parquet first since it's small and pre-filtered
ap = pd.read_parquet(PARQUET_AFRICA, columns=["doc_id", "sender", "subject", "sent_at",
                                              "all_participants", "epstein_is_sender"])
print(f"  africa.parquet rows: {len(ap)}")
ap = ap[ap["all_participants"].notna()]

def parse_participants(s):
    if not s:
        return []
    parts = re.split(r"[,;]", s)
    out = []
    for p in parts:
        p = p.strip().lower()
        # Strip email if present
        m = re.search(r"<([^>]+)>", p)
        if m:
            p = m.group(1).strip()
        # Get domain or local part as identifier
        if p:
            out.append(p)
    return out

ap["parts"] = ap["all_participants"].apply(parse_participants)

# For each row, generate Epstein-paired co-participants
def epstein_pairs(parts):
    has_e = any("epstein" in p or "jeevacation" in p or "jeeproject" in p for p in parts)
    if not has_e:
        return []
    others = [p for p in parts if not ("epstein" in p or "jeevacation" in p or "jeeproject" in p)]
    return others

ap["others"] = ap["parts"].apply(epstein_pairs)
ap = ap[ap["others"].apply(len) > 0]
print(f"  rows with Epstein + at least one other party: {len(ap)}")

# Count occurrences of each "other" across all rows
other_counts = Counter()
for others in ap["others"]:
    for o in others:
        other_counts[o] += 1

# One-time co-participants (only one row in africa.parquet)
once_others = {o for o, c in other_counts.items() if c == 1}
print(f"  one-time Epstein co-participants: {len(once_others)}")

# Filter rows where any "other" is one-time and not profiled
def has_unique_other(others):
    for o in others:
        if o in once_others and not any(p in o for p in PROFILED):
            return o
    return None

ap["bridge_other"] = ap["others"].apply(has_unique_other)
bridges = ap[ap["bridge_other"].notna()].copy()
print(f"  bridge moments (one-time, unprofiled): {len(bridges)}")

# Sort: prefer those with subject content
bridges["has_subj"] = bridges["subject"].fillna("").str.len() > 5

# Pull body from full parquet for these doc_ids
bridge_doc_ids = set(bridges["doc_id"].tolist())
print(f"  loading bodies from full parquet for {len(bridge_doc_ids)} bridge doc_ids...")
full_subset = pd.read_parquet(PARQUET_FULL, columns=["doc_id", "content_markdown"],
                              filters=[("doc_id", "in", list(bridge_doc_ids))])
body_map = dict(zip(full_subset["doc_id"], full_subset["content_markdown"]))
print(f"  matched {len(body_map)} bodies")

bridges["body"] = bridges["doc_id"].map(body_map)
bridges["body_len"] = bridges["body"].fillna("").str.len()
bridges = bridges[bridges["body_len"] > 30]
bridges = bridges.sort_values(["has_subj", "body_len"], ascending=[False, False])

lines = ["## Algorithm 6: Bridge Moments (one-time Epstein co-appearances)\n",
         f"Africa parquet rows with Epstein + 1+ other party: **{sum(1 for _ in ap.iterrows())}**\n",
         f"One-time co-participants (unprofiled): **{len(bridges)}**\n"]

lines.append("### Top bridge moments (sorted by body density)\n")
for _, row in bridges.head(40).iterrows():
    body = (row.get("body") or "")[:300].replace("\n", " ").replace("\r", " ")
    lines.append(f"- `{row['doc_id']}` | **{short(row['bridge_other'], 50)}** | {short(str(row.get('sent_at') or ''), 10)}")
    lines.append(f"  sender: {short(row.get('sender') or '', 35)}  | subject: {short(row.get('subject') or '', 70)}")
    lines.append(f"  {body}")
    lines.append("")
sections["alg6"] = "\n".join(lines)

# Save bridge leads for later cross-ranking
algo6_bridges = bridges.head(40).to_dict("records")

# ---------------------------------------------------------------------------
# Top-10 cross-algorithm synthesis
# ---------------------------------------------------------------------------

print("\n[Synth] Building Top 10...")

# Build a candidate pool from each algorithm's top picks
candidates = []

# From Algo 1: top africa-tagged bursts
for b in deduped[:10]:
    africa_rows = [r for r in b["rows"] if r[4] and any(c in (r[4] or "") for c in PUBLISHED_COUNTRIES)]
    if africa_rows:
        candidates.append({
            "kind": "burst",
            "key": f"burst_{b['date_start']}",
            "score_africa": 1,
            "score_unprofiled": min(b["unprofiled_count"], 10),
            "score_density": min(b["total"], 20),
            "label": f"Burst {b['date_start']}→{b['date_end']}: {b['total']} emails, {b['unprofiled_count']} unprofiled, countries: {sorted(set(r[4] for r in africa_rows if r[4]))[:3]}",
            "doc_ids": [r[0] for r in b["rows"][:6]],
        })

# From Algo 2: unpublished countries with substantial counts
for c, n in sorted_unpub[:8]:
    if n < 5:
        continue
    rs = country_emails[c]
    candidates.append({
        "kind": "country_gap",
        "key": f"country_{c}",
        "score_africa": 1 if c in {"Tunisia","Algeria","Mali","Burkina Faso","Niger","Namibia","Botswana","Zambia","Uganda","Madagascar","Mauritius","Lesotho","Malawi","Guinea","Liberia","Sierra Leone","Togo","Benin","Chad","Eritrea","South Sudan","Mauritania","Cape Verde","Comoros","Eswatini","Swaziland"} else 0,
        "score_unprofiled": min(len(set(r[1] for r in rs if r[1])), 10),
        "score_density": min(n, 20),
        "label": f"Unpublished country {c}: {n} emails, {len(set(r[1] for r in rs if r[1]))} senders",
        "doc_ids": [r[0] for r in rs[:6]],
    })

# From Algo 3: africa-relevant intel/financial forwards
for bucket in ["intel", "financial"]:
    rs = buckets.get(bucket, [])
    africa_relevant = [r for r in rs if has_africa((r[3] or "") + " " + (r[5] or "")[:500])]
    for r in africa_relevant[:5]:
        candidates.append({
            "kind": f"fwd_{bucket}",
            "key": f"fwd_{r[0]}",
            "score_africa": 1,
            "score_unprofiled": 1,
            "score_density": 3,
            "label": f"Forward ({bucket}): {(r[1] or '')[:25]} | {(r[2] or '')[:10]} | {short(r[3] or '', 60)}",
            "doc_ids": [r[0]],
        })

# From Algo 4: africa-relevant rare senders
seen_senders = set()
for rec in algo4_africa_leads:
    sender = rec["sender"]
    if sender in seen_senders:
        continue
    seen_senders.add(sender)
    candidates.append({
        "kind": "single_contact",
        "key": f"sc_{sender}",
        "score_africa": 1,
        "score_unprofiled": 2,
        "score_density": 1,
        "label": f"Cold ask: {short(sender, 35)} | {short(str(rec.get('sent_at') or ''), 10)} | {short(rec.get('subject') or '', 70)}",
        "doc_ids": [rec["doc_id"]],
    })

# From Algo 5: africa-relevant Groff operations
for r in africa_groff[:8]:
    candidates.append({
        "kind": "groff_op",
        "key": f"groff_{r[0]}",
        "score_africa": 1,
        "score_unprofiled": 2,
        "score_density": 2,
        "label": f"Groff op: {(r[2] or '')[:10]} | {short(r[3] or '', 60)}",
        "doc_ids": [r[0]],
    })

# From Algo 6: bridge moments
for rec in algo6_bridges[:15]:
    candidates.append({
        "kind": "bridge",
        "key": f"bridge_{rec['doc_id']}",
        "score_africa": 1,
        "score_unprofiled": 3,
        "score_density": 1,
        "label": f"Bridge: {short(rec.get('bridge_other') or '', 40)} | {short(str(rec.get('sent_at') or ''), 10)} | {short(rec.get('subject') or '', 50)}",
        "doc_ids": [rec["doc_id"]],
    })

# Score
for c in candidates:
    c["total"] = c["score_africa"] * 10 + c["score_unprofiled"] * 2 + c["score_density"]

candidates.sort(key=lambda c: -c["total"])

# Dedupe by kind+label prefix
seen_keys = set()
top10 = []
for c in candidates:
    if c["key"] in seen_keys:
        continue
    seen_keys.add(c["key"])
    top10.append(c)
    if len(top10) >= 10:
        break

lines = ["## Top 10 Leads (cross-algorithm synthesis)\n",
         "Ranked by: africa relevance × 10 + unprofiled participants × 2 + document density.\n"]
for i, c in enumerate(top10, 1):
    lines.append(f"### #{i}. [{c['kind']}] {c['label']}")
    lines.append(f"  - score: {c['total']}")
    lines.append(f"  - doc_ids: {', '.join(c['doc_ids'])}")
    lines.append("")
sections["top10"] = "\n".join(lines)

# ---------------------------------------------------------------------------
# Write output
# ---------------------------------------------------------------------------

print(f"\nWriting {OUT}...")
OUT.parent.mkdir(parents=True, exist_ok=True)

header = f"""# Structural Lead Discovery — {datetime.now().strftime('%Y-%m-%d')}

Pass: 6 algorithms against `web/data/research.db` (74,668 rows) + `data/jmail/emails-full.parquet` (1.78M rows) + `data/jmail/africa.parquet` (2,030 rows).
Production DB: `web/data/epstein_africa.db` ({len(prod_docids)} doc_ids — used as exclusion set).

"""

body_md = "\n\n---\n\n".join([
    sections["top10"],
    sections["alg1"],
    sections["alg2"],
    sections["alg3"],
    sections["alg4"],
    sections["alg5"],
    sections["alg6"],
])

OUT.write_text(header + body_md)
print(f"  wrote {OUT.stat().st_size} bytes")

res.close()
prod.close()
print("\nDone.")
