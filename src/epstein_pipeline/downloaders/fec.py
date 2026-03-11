"""FEC political donations cross-reference via the FEC API.

Searches the Federal Election Commission Schedule A (individual contributions)
database for political donations by persons in the Epstein database.

API docs: https://api.open.fec.gov/developers/
Requires: EPSTEIN_FEC_API_KEY environment variable.
"""

from __future__ import annotations

import json
import time
from collections import defaultdict
from pathlib import Path

import httpx
from rich.console import Console
from rich.progress import (
    BarColumn,
    MofNCompleteColumn,
    Progress,
    SpinnerColumn,
    TextColumn,
    TimeRemainingColumn,
)
from rich.table import Table

console = Console()

# ---------------------------------------------------------------------------
# FEC API
# ---------------------------------------------------------------------------
_API_BASE = "https://api.open.fec.gov/v1"
_SCHEDULE_A = f"{_API_BASE}/schedules/schedule_a/"
_COMMITTEE = f"{_API_BASE}/committee"

# Rate limit: 120 req/min = 1 req per 0.5s
_RATE_LIMIT_DELAY = 0.55

# Common first names that require location disambiguation
_COMMON_FIRST_NAMES = frozenset({
    "james", "john", "robert", "michael", "david", "william", "richard",
    "joseph", "thomas", "charles", "christopher", "daniel", "matthew",
    "anthony", "mark", "donald", "steven", "paul", "andrew", "joshua",
    "kenneth", "kevin", "brian", "george", "timothy", "ronald", "edward",
    "jason", "jeffrey", "ryan", "mary", "patricia", "jennifer", "linda",
    "barbara", "elizabeth", "susan", "jessica", "sarah", "karen",
})


def _is_common_name(name: str) -> bool:
    """Check if a name has a common first name + short last name."""
    parts = name.lower().strip().split()
    if not parts:
        return False
    first = parts[0]
    last = parts[-1] if len(parts) > 1 else ""
    return first in _COMMON_FIRST_NAMES and len(last) <= 6


def _search_contributions(
    client: httpx.Client,
    name: str,
    api_key: str,
    *,
    min_amount: int = 200,
    max_pages: int = 5,
    city: str | None = None,
    state: str | None = None,
) -> list[dict]:
    """Search FEC Schedule A for contributions by a contributor name.

    Returns list of raw contribution dicts from the API.
    """
    all_results: list[dict] = []

    params: dict = {
        "api_key": api_key,
        "contributor_name": name,
        "min_amount": str(min_amount),
        "sort": "-contribution_receipt_amount",
        "per_page": "100",
        "is_individual": "true",
    }

    if city:
        params["contributor_city"] = city
    if state:
        params["contributor_state"] = state

    for page in range(1, max_pages + 1):
        params["page"] = str(page)

        try:
            resp = client.get(_SCHEDULE_A, params=params, timeout=20.0)

            if resp.status_code == 429:
                # Rate limited — wait and retry
                time.sleep(5.0)
                resp = client.get(_SCHEDULE_A, params=params, timeout=20.0)

            resp.raise_for_status()
            data = resp.json()

            results = data.get("results", [])
            if not results:
                break

            all_results.extend(results)

            # Check pagination
            pagination = data.get("pagination", {})
            if page >= pagination.get("pages", 1):
                break

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 422:
                break  # Invalid query
            raise
        except Exception:
            break

        time.sleep(_RATE_LIMIT_DELAY)

    return all_results


def _extract_inline_committee_info(raw_contrib: dict) -> dict:
    """Extract committee/candidate info already present in the Schedule A response.

    The FEC Schedule A endpoint embeds a nested `committee` object and often
    includes candidate fields directly, so we can avoid a separate API call.
    """
    info: dict[str, str] = {
        "committee_name": "",
        "candidate_name": "",
        "candidate_party": "",
        "candidate_office": "",
        "candidate_state": "",
    }
    # Nested committee object
    committee = raw_contrib.get("committee", {}) or {}
    if committee:
        info["committee_name"] = committee.get("name", "") or ""
        info["candidate_party"] = committee.get("party", "") or ""
        # Some committee objects carry candidate_ids with embedded info
        cand_ids = committee.get("candidate_ids", [])
        if cand_ids:
            info["candidate_name"] = committee.get("candidate_name", "") or ""
            info["candidate_office"] = committee.get("office", "") or ""
            info["candidate_state"] = committee.get("state", "") or ""
    # Top-level fields override if present
    if raw_contrib.get("candidate_name"):
        info["candidate_name"] = raw_contrib["candidate_name"]
    if raw_contrib.get("candidate_id"):
        # Party sometimes at top level
        info["candidate_party"] = raw_contrib.get("party", info["candidate_party"]) or ""
    return info


def _resolve_committee(
    client: httpx.Client,
    committee_id: str,
    api_key: str,
    cache: dict[str, dict],
) -> dict:
    """Resolve a committee ID to candidate info via API. Results are cached.

    Has a 10-second timeout to prevent hanging on slow responses.
    """
    if committee_id in cache:
        return cache[committee_id]

    try:
        resp = client.get(
            f"{_COMMITTEE}/{committee_id}/",
            params={"api_key": api_key},
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()
        results = data.get("results", [])
        if results:
            info = {
                "committee_name": results[0].get("name", ""),
                "candidate_name": "",
                "candidate_party": "",
                "candidate_office": "",
                "candidate_state": "",
            }
            candidate_ids = results[0].get("candidate_ids", [])
            if candidate_ids:
                info["candidate_name"] = results[0].get("candidate_name", "") or ""
                info["candidate_party"] = results[0].get("party", "") or ""
                info["candidate_office"] = results[0].get("office", "") or ""
                info["candidate_state"] = results[0].get("state", "") or ""

            cache[committee_id] = info
            time.sleep(_RATE_LIMIT_DELAY)
            return info
    except Exception:
        pass

    cache[committee_id] = {}
    return {}


def _match_contribution(
    contribution: dict,
    person_name: str,
) -> float:
    """Score how well a contribution matches the target person.

    Returns a score 0-1.
    """
    contrib_name = contribution.get("contributor_name", "")
    if not contrib_name:
        return 0.0

    # Normalize both names
    pn = person_name.lower().strip()
    cn = contrib_name.lower().strip()

    # FEC names are often "LAST, FIRST" format
    if "," in cn:
        parts = cn.split(",", 1)
        cn = f"{parts[1].strip()} {parts[0].strip()}"

    # Exact match
    if cn == pn:
        return 1.0

    # Check if all parts of person name are in contributor name
    pn_parts = set(pn.split())
    cn_parts = set(cn.split())
    if pn_parts == cn_parts:
        return 0.98

    # All person name parts present in contributor name
    if pn_parts.issubset(cn_parts):
        return 0.95

    # Try rapidfuzz if available
    try:
        from rapidfuzz import fuzz
        ratio = fuzz.token_sort_ratio(pn, cn)
        return ratio / 100.0
    except ImportError:
        pass

    return 0.0


def download_fec(
    output_dir: Path,
    *,
    api_key: str,
    persons_registry_path: Path | None = None,
    min_amount: int = 200,
    max_pages: int = 5,
    max_persons: int | None = None,
    resume: bool = True,
) -> None:
    """Cross-reference all persons against FEC political donation records.

    Searches Schedule A (individual contributions) for each person and
    records matches with party, amount, and candidate information.

    Args:
        output_dir: Where to save results JSON
        api_key: FEC API key
        persons_registry_path: Path to persons-registry.json
        min_amount: Minimum contribution amount in dollars (FEC threshold is $200)
        max_pages: Max API pages per person search
        max_persons: Limit number of persons to check (for testing)
        resume: Skip persons already cached from previous runs
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    cache_dir = output_dir / "fec-cache"
    cache_dir.mkdir(exist_ok=True)

    # Load persons registry
    registry_path = persons_registry_path or Path("./data/persons-registry.json")
    if not registry_path.exists():
        console.print(f"[red]Persons registry not found at {registry_path}[/red]")
        return

    with open(registry_path, encoding="utf-8") as f:
        persons = json.load(f)

    if isinstance(persons, dict):
        persons_list = list(persons.values()) if not isinstance(next(iter(persons.values()), None), str) else [persons]
    elif isinstance(persons, list):
        persons_list = persons
    else:
        console.print("[red]Unexpected persons registry format[/red]")
        return

    # Filter out non-person entries (flight records, redacted names, single words)
    import re

    def _is_real_person_name(name: str) -> bool:
        if not name or len(name) < 5:
            return False
        if not re.match(r'^[A-Za-z]', name):
            return False
        parts = name.strip().split()
        if len(parts) < 2:
            return False
        # Skip obvious non-names
        if any(x in name.lower() for x in ['accuser', 'officer', 'lieutenant', 'sergeant',
                                             'detective', 'unknown', 'records', 'foia',
                                             'agent', 'doe', 'anonymous']):
            return False
        # Skip title + single surname (e.g., "Mr. Johnson", "MR. DAVIS", "Ms. George")
        # These match thousands of unrelated FEC donors
        if re.match(r'^(?:Mr|Mrs|Ms|Miss|MR|MRS|MS)\.?\s+\S+$', name.strip()):
            return False
        # Skip ALL CAPS single-word surnames with title
        if re.match(r'^(?:MR|MRS|MS)\.?\s+[A-Z]+$', name.strip()):
            return False
        return True

    original_count = len(persons_list)
    persons_list = [p for p in persons_list if _is_real_person_name(p.get("name", ""))]

    if max_persons:
        persons_list = persons_list[:max_persons]

    console.print("[bold]FEC Political Donations Cross-Reference[/bold]")
    console.print(f"Persons to check: [cyan]{len(persons_list)}[/cyan] (filtered from {original_count})")
    console.print(f"API: [cyan]{_API_BASE}[/cyan]")
    console.print(f"Min amount: [cyan]${min_amount}[/cyan]")
    console.print(f"Resume from cache: [cyan]{resume}[/cyan]")
    console.print()

    # Load committee cache
    committee_cache_path = cache_dir / "committees.json"
    committee_cache: dict[str, dict] = {}
    if committee_cache_path.exists():
        with open(committee_cache_path, encoding="utf-8") as f:
            committee_cache = json.load(f)

    results: list[dict] = []
    total_contributions = 0
    total_amount = 0
    donors_found = 0
    skipped_common = 0
    skipped_cached = 0
    errors = 0

    with httpx.Client(timeout=30.0) as client:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            MofNCompleteColumn(),
            TimeRemainingColumn(),
            console=console,
        ) as progress:
            task = progress.add_task("Checking persons...", total=len(persons_list))

            for person in persons_list:
                person_id = person.get("id", person.get("slug", ""))
                person_name = person.get("name", "")
                person_city = person.get("city", "")
                person_state = person.get("state", "")

                if not person_name or len(person_name) < 3:
                    progress.advance(task)
                    continue

                progress.update(task, description=f"Checking {person_name[:30]}...")

                # Check cache
                cache_file = cache_dir / f"{person_id}.json"
                if resume and cache_file.exists():
                    try:
                        with open(cache_file, encoding="utf-8") as f:
                            cached = json.load(f)
                        results.append(cached)
                        if cached.get("contributions"):
                            donors_found += 1
                            total_contributions += len(cached["contributions"])
                            total_amount += cached.get("total_amount", 0)
                        skipped_cached += 1
                        progress.advance(task)
                        continue
                    except Exception:
                        pass

                # Common name check
                is_common = _is_common_name(person_name)
                if is_common and not person_city and not person_state:
                    result = {
                        "person_id": person_id,
                        "person_name": person_name,
                        "contributions": [],
                        "total_amount": 0,
                        "contribution_count": 0,
                        "party_breakdown": {},
                        "cycle_breakdown": {},
                        "skipped_common_name": True,
                        "checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    }
                    results.append(result)
                    skipped_common += 1
                    # Cache the skip
                    with open(cache_file, "w", encoding="utf-8") as f:
                        json.dump(result, f)
                    progress.advance(task)
                    continue

                try:
                    # Search FEC
                    raw_contribs = _search_contributions(
                        client, person_name, api_key,
                        min_amount=min_amount,
                        max_pages=max_pages,
                        city=person_city if is_common else None,
                        state=person_state if is_common else None,
                    )

                    # Score and filter
                    contributions: list[dict] = []
                    party_totals: dict[str, int] = defaultdict(int)
                    cycle_totals: dict[str, int] = defaultdict(int)
                    person_total = 0

                    for rc in raw_contribs:
                        score = _match_contribution(rc, person_name)
                        if score < 0.85:
                            continue

                        amount = int(rc.get("contribution_receipt_amount", 0) * 100)  # to cents
                        date = rc.get("contribution_receipt_date", "")
                        committee_id = rc.get("committee_id", "")
                        cycle = str(rc.get("two_year_transaction_period", ""))

                        # Extract committee/candidate info from the Schedule A response
                        # This avoids slow per-contribution API calls to /committee/{id}
                        committee_info = _extract_inline_committee_info(rc)

                        party = committee_info.get("candidate_party", "") or ""

                        contrib = {
                            "transaction_id": rc.get("sub_id", rc.get("transaction_id", "")),
                            "contributor_name": rc.get("contributor_name", ""),
                            "contributor_city": rc.get("contributor_city", ""),
                            "contributor_state": rc.get("contributor_state", ""),
                            "contributor_zip": rc.get("contributor_zip", ""),
                            "contributor_employer": rc.get("contributor_employer", ""),
                            "contributor_occupation": rc.get("contributor_occupation", ""),
                            "committee_id": committee_id,
                            "committee_name": committee_info.get("committee_name", rc.get("committee", {}).get("name", "")),
                            "candidate_name": committee_info.get("candidate_name", ""),
                            "candidate_party": party,
                            "candidate_office": committee_info.get("candidate_office", ""),
                            "candidate_state": committee_info.get("candidate_state", ""),
                            "amount": amount,
                            "date": date,
                            "election_cycle": cycle,
                            "receipt_type": rc.get("receipt_type", ""),
                            "match_score": score,
                            "match_method": "exact" if score >= 0.98 else "fuzzy",
                        }
                        contributions.append(contrib)
                        person_total += amount
                        if party:
                            party_totals[party] += amount
                        if cycle:
                            cycle_totals[cycle] += amount

                    # Build result
                    dates = [c["date"] for c in contributions if c["date"]]
                    result = {
                        "person_id": person_id,
                        "person_name": person_name,
                        "contributions": contributions,
                        "total_amount": person_total,
                        "contribution_count": len(contributions),
                        "party_breakdown": dict(party_totals),
                        "cycle_breakdown": dict(cycle_totals),
                        "date_range": [min(dates), max(dates)] if dates else None,
                        "skipped_common_name": False,
                        "checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    }

                    if contributions:
                        donors_found += 1
                        total_contributions += len(contributions)
                        total_amount += person_total

                    results.append(result)

                    # Cache individual result
                    with open(cache_file, "w", encoding="utf-8") as f:
                        json.dump(result, f)

                    # Periodically save committee cache (every 20 persons)
                    if len(results) % 20 == 0:
                        with open(committee_cache_path, "w", encoding="utf-8") as f:
                            json.dump(committee_cache, f, indent=2)

                except Exception as e:
                    errors += 1
                    if errors <= 5:
                        console.print(f"[yellow]Error for {person_name}: {e}[/yellow]")
                    result = {
                        "person_id": person_id,
                        "person_name": person_name,
                        "contributions": [],
                        "total_amount": 0,
                        "contribution_count": 0,
                        "error": str(e),
                        "checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    }
                    results.append(result)

                progress.advance(task)
                time.sleep(_RATE_LIMIT_DELAY)

    # Save committee cache
    with open(committee_cache_path, "w", encoding="utf-8") as f:
        json.dump(committee_cache, f, indent=2)

    # Save results
    output_file = output_dir / "fec-results.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(
            {
                "metadata": {
                    "source": "Federal Election Commission",
                    "api_url": _API_BASE,
                    "total_persons_checked": len(results),
                    "total_donors_found": donors_found,
                    "total_contributions": total_contributions,
                    "total_amount_cents": total_amount,
                    "skipped_common_names": skipped_common,
                    "skipped_cached": skipped_cached,
                    "min_amount": min_amount,
                    "checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                },
                "results": results,
            },
            f,
            indent=2,
        )

    console.print()
    console.print(f"[green]Results saved to {output_file}[/green]")
    console.print()

    # Summary table
    table = Table(title="FEC Political Donations Cross-Reference Summary")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="bold")
    table.add_row("Persons checked", str(len(results)))
    table.add_row("Donors found", str(donors_found))
    table.add_row("Total contributions", str(total_contributions))
    table.add_row("Total amount", f"${total_amount / 100:,.2f}")
    table.add_row("Skipped (common name)", str(skipped_common))
    table.add_row("Cached (resumed)", str(skipped_cached))
    table.add_row("Errors", str(errors))
    console.print(table)

    # Show top donors
    donors = [r for r in results if r.get("contributions")]
    if donors:
        console.print()
        donor_table = Table(title="Top Donors")
        donor_table.add_column("Person", style="white")
        donor_table.add_column("Contributions", style="cyan")
        donor_table.add_column("Total", style="green")
        donor_table.add_column("Parties", style="yellow")
        donor_table.add_column("Date Range", style="dim")

        top = sorted(donors, key=lambda x: x.get("total_amount", 0), reverse=True)[:25]
        for d in top:
            parties = ", ".join(d.get("party_breakdown", {}).keys())
            dr = d.get("date_range")
            date_range = f"{dr[0][:10]}–{dr[1][:10]}" if dr else ""
            donor_table.add_row(
                d["person_name"],
                str(d["contribution_count"]),
                f"${d['total_amount'] / 100:,.2f}",
                parties,
                date_range,
            )

        console.print(donor_table)
