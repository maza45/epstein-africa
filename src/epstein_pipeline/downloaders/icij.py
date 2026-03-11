"""ICIJ Offshore Leaks cross-reference via local CSV data.

Reads the ICIJ Offshore Leaks bulk download CSVs and cross-references
all persons in the Epstein database against Panama Papers, Paradise Papers,
Pandora Papers, and Bahamas Leaks data.

CSV data: https://offshoreleaks.icij.org/pages/database
Default location: E:\\CapitolGraph\\data\\icij\\extracted\\
"""

from __future__ import annotations

import csv
import json
import re
import time
import unicodedata
from collections import defaultdict
from dataclasses import asdict
from pathlib import Path

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

# Dataset mapping from source_id prefix
_DATASET_MAP = {
    "Panama Papers": "Panama Papers",
    "Paradise Papers": "Paradise Papers",
    "Pandora Papers": "Pandora Papers",
    "Bahamas Leaks": "Bahamas Leaks",
    "Offshore Leaks": "Offshore Leaks",
}

# Common names that require higher match threshold (50+ appearances in ICIJ data)
_COMMON_NAME_THRESHOLD = 50
_COMMON_NAME_MIN_SCORE = 0.95


def _normalize_name(name: str) -> str:
    """Normalize a name for matching: lowercase, strip accents, remove punctuation."""
    if not name:
        return ""
    # Unicode normalization - decompose accents
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    # Lowercase, strip extra whitespace, remove punctuation
    name = name.lower().strip()
    name = re.sub(r"[^\w\s]", " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def _derive_dataset(source_id: str) -> str:
    """Map a source_id to a human-readable dataset name."""
    if not source_id:
        return "Offshore Leaks"
    sid = source_id.strip()
    for key in _DATASET_MAP:
        if key.lower().replace(" ", "") in sid.lower().replace(" ", "").replace("-", ""):
            return key
    # Check common prefixes
    if "panama" in sid.lower():
        return "Panama Papers"
    if "paradise" in sid.lower():
        return "Paradise Papers"
    if "pandora" in sid.lower():
        return "Pandora Papers"
    if "bahamas" in sid.lower():
        return "Bahamas Leaks"
    return "Offshore Leaks"


def _build_name_index(csv_path: Path, node_type: str) -> tuple[dict[str, list[dict]], int]:
    """Build a normalized_name → [row_dicts] index from a CSV file.

    Returns (index_dict, total_rows_read).
    Streams the CSV to avoid loading everything into memory at once.
    """
    index: dict[str, list[dict]] = defaultdict(list)
    count = 0

    if not csv_path.exists():
        console.print(f"[yellow]Warning: {csv_path} not found, skipping[/yellow]")
        return dict(index), 0

    with open(csv_path, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get("name", "").strip()
            if not name or len(name) < 3:
                continue
            normalized = _normalize_name(name)
            if not normalized:
                continue
            row["_node_type"] = node_type
            row["_normalized_name"] = normalized
            index[normalized].append(row)
            count += 1

    return dict(index), count


def _load_relationships(csv_path: Path) -> dict[str, list[dict]]:
    """Load relationships.csv into an adjacency map: node_id → [relationship_dicts]."""
    adj: dict[str, list[dict]] = defaultdict(list)

    if not csv_path.exists():
        console.print(f"[yellow]Warning: {csv_path} not found, skipping relationships[/yellow]")
        return dict(adj)

    with open(csv_path, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            start = row.get("node_id_start", row.get("START_ID", "")).strip()
            end = row.get("node_id_end", row.get("END_ID", "")).strip()
            if start and end:
                adj[start].append(row)
                adj[end].append(row)

    return dict(adj)


def _build_prefix_index(icij_index: dict[str, list[dict]]) -> dict[str, list[str]]:
    """Build a prefix-bucketed index for fast fuzzy candidate filtering.

    Groups ICIJ normalized names by the first 3 characters of their first
    and last words. When querying, only names sharing a prefix with the
    query are compared — reducing the search space from 500K+ to ~500.
    """
    prefix_index: dict[str, list[str]] = defaultdict(list)
    for name in icij_index:
        parts = name.split()
        if not parts:
            continue
        for p in {parts[0][:3], parts[-1][:3]}:
            if p:
                prefix_index[p].append(name)
    return dict(prefix_index)


def _match_persons(
    persons_list: list[dict],
    icij_index: dict[str, list[dict]],
    node_type: str,
    *,
    fuzzy_threshold: int = 85,
    min_name_length: int = 5,
    name_counts: dict[str, int] | None = None,
) -> list[dict]:
    """3-phase matching: exact → alias → fuzzy.

    Returns list of match dicts with person_id, person_name, icij fields, score, method.
    """
    matches = []

    for person in persons_list:
        person_id = person.get("id", person.get("slug", ""))
        person_name = person.get("name", "")
        if not person_name or len(person_name) < min_name_length:
            continue

        normalized = _normalize_name(person_name)
        if not normalized:
            continue

        # Phase 1: Exact normalized match
        if normalized in icij_index:
            for row in icij_index[normalized]:
                # Common name protection
                freq = (name_counts or {}).get(normalized, 1)
                if freq >= _COMMON_NAME_THRESHOLD:
                    continue  # Skip common names in exact match too unless very specific

                matches.append({
                    "person_id": person_id,
                    "person_name": person_name,
                    "icij_node_id": row.get("node_id", row.get("_id", "")),
                    "icij_name": row.get("name", ""),
                    "icij_type": node_type,
                    "icij_jurisdiction": row.get("jurisdiction", row.get("jurisdiction_description", "")),
                    "icij_country_codes": row.get("country_codes", row.get("countries", "")),
                    "icij_dataset": _derive_dataset(row.get("sourceID", row.get("source_id", ""))),
                    "match_score": 1.0,
                    "match_method": "exact",
                    "incorporation_date": row.get("incorporation_date", row.get("inactivation_date", None)),
                    "company_type": row.get("company_type", ""),
                    "address": row.get("address", row.get("registered_address", "")),
                })

        # Phase 2: Alias match (check person aliases against index)
        aliases = person.get("aliases", [])
        if isinstance(aliases, str):
            aliases = [a.strip() for a in aliases.split(",") if a.strip()]
        for alias in aliases:
            norm_alias = _normalize_name(alias)
            if norm_alias and norm_alias != normalized and norm_alias in icij_index:
                for row in icij_index[norm_alias]:
                    freq = (name_counts or {}).get(norm_alias, 1)
                    if freq >= _COMMON_NAME_THRESHOLD:
                        continue

                    matches.append({
                        "person_id": person_id,
                        "person_name": person_name,
                        "icij_node_id": row.get("node_id", row.get("_id", "")),
                        "icij_name": row.get("name", ""),
                        "icij_type": node_type,
                        "icij_jurisdiction": row.get("jurisdiction", row.get("jurisdiction_description", "")),
                        "icij_country_codes": row.get("country_codes", row.get("countries", "")),
                        "icij_dataset": _derive_dataset(row.get("sourceID", row.get("source_id", ""))),
                        "match_score": 0.95,
                        "match_method": "alias",
                        "incorporation_date": row.get("incorporation_date", None),
                        "company_type": row.get("company_type", ""),
                        "address": row.get("address", ""),
                    })

    # Phase 3: Prefix-bucketed fuzzy match using rapidfuzz (very fast)
    # Instead of comparing each person against ALL 500K+ ICIJ names,
    # we only compare against names sharing a 3-char prefix (~500 candidates).
    # This reduces matching time from ~12 minutes to ~2 seconds.
    try:
        from rapidfuzz import process, fuzz

        prefix_idx = _build_prefix_index(icij_index)

        # Collect already-matched node_ids per person for dedup
        matched_nodes: dict[str, set[str]] = {}
        for m in matches:
            matched_nodes.setdefault(m["person_id"], set()).add(m["icij_node_id"])

        for person in persons_list:
            pid = person.get("id", person.get("slug", ""))
            pname = person.get("name", "")
            if not pname or len(pname) < min_name_length:
                continue
            norm = _normalize_name(pname)
            if not norm:
                continue

            # Get fuzzy candidates from prefix buckets
            parts = norm.split()
            if not parts:
                continue
            candidates: set[str] = set()
            for p in {parts[0][:3], parts[-1][:3]}:
                candidates.update(prefix_idx.get(p, []))

            if not candidates:
                continue

            results = process.extract(
                norm, list(candidates),
                scorer=fuzz.token_sort_ratio,
                score_cutoff=fuzzy_threshold,
                limit=10,
            )
            existing_nodes = matched_nodes.get(pid, set())

            for icij_name, ratio, _idx in results:
                score = ratio / 100.0
                freq = (name_counts or {}).get(icij_name, 1)
                if freq >= _COMMON_NAME_THRESHOLD and score < _COMMON_NAME_MIN_SCORE:
                    continue

                for row in icij_index[icij_name]:
                    node_id = row.get("node_id", row.get("_id", ""))
                    if node_id in existing_nodes:
                        continue
                    existing_nodes.add(node_id)

                    matches.append({
                        "person_id": pid,
                        "person_name": pname,
                        "icij_node_id": node_id,
                        "icij_name": row.get("name", ""),
                        "icij_type": node_type,
                        "icij_jurisdiction": row.get("jurisdiction", row.get("jurisdiction_description", "")),
                        "icij_country_codes": row.get("country_codes", row.get("countries", "")),
                        "icij_dataset": _derive_dataset(row.get("sourceID", row.get("source_id", ""))),
                        "match_score": score,
                        "match_method": "fuzzy",
                        "incorporation_date": row.get("incorporation_date", None),
                        "company_type": row.get("company_type", ""),
                        "address": row.get("address", ""),
                    })

            matched_nodes[pid] = existing_nodes
    except ImportError:
        console.print("[yellow]Warning: rapidfuzz not installed, skipping fuzzy matching[/yellow]")

    return matches


def _traverse_relationships(
    matched_node_ids: set[str],
    relationships: dict[str, list[dict]],
    entity_index: dict[str, dict],
    person_matches: dict[str, tuple[str, str]],
    *,
    max_depth: int = 2,
) -> list[dict]:
    """BFS traversal from matched officers/intermediaries to connected entities.

    Args:
        matched_node_ids: Set of ICIJ node_ids that matched persons
        relationships: adjacency map from _load_relationships
        entity_index: node_id → entity row dict
        person_matches: node_id → (person_id, person_name) for matched nodes
        max_depth: max traversal depth

    Returns list of relationship chain dicts.
    """
    chains = []
    visited: set[tuple[str, str]] = set()  # (source_node, target_node) pairs

    for start_node_id in matched_node_ids:
        if start_node_id not in person_matches:
            continue
        person_id, person_name = person_matches[start_node_id]

        # BFS from this node
        queue = [(start_node_id, 1)]
        seen = {start_node_id}

        while queue:
            current_id, depth = queue.pop(0)
            if depth > max_depth:
                continue

            for rel in relationships.get(current_id, []):
                start = rel.get("node_id_start", rel.get("START_ID", ""))
                end = rel.get("node_id_end", rel.get("END_ID", ""))
                other_id = end if start == current_id else start

                if other_id in seen:
                    continue
                seen.add(other_id)

                pair_key = (start_node_id, other_id)
                if pair_key in visited:
                    continue
                visited.add(pair_key)

                # Check if the other node is in entity index
                if other_id in entity_index:
                    entity = entity_index[other_id]
                    chains.append({
                        "source_person_id": person_id,
                        "source_person_name": person_name,
                        "officer_node_id": start_node_id,
                        "officer_name": "",  # Will be filled from match data
                        "entity_node_id": other_id,
                        "entity_name": entity.get("name", ""),
                        "relationship_type": rel.get("rel_type", rel.get("TYPE", "connected")),
                        "entity_jurisdiction": entity.get("jurisdiction", entity.get("jurisdiction_description", "")),
                        "entity_country_codes": entity.get("country_codes", entity.get("countries", "")),
                        "dataset": _derive_dataset(entity.get("sourceID", entity.get("source_id", ""))),
                        "depth": depth,
                    })

                if depth < max_depth:
                    queue.append((other_id, depth + 1))

    return chains


def download_icij(
    output_dir: Path,
    *,
    icij_data_dir: Path | None = None,
    persons_registry_path: Path | None = None,
    fuzzy_threshold: int = 85,
    min_name_length: int = 5,
    traverse_relationships: bool = True,
) -> None:
    """Cross-reference all persons against ICIJ Offshore Leaks CSV data.

    Checks every person in the registry against entities, officers, and
    intermediaries from Panama Papers, Paradise Papers, Pandora Papers,
    Bahamas Leaks, and Offshore Leaks data.

    Args:
        output_dir: Where to save results JSON
        icij_data_dir: Path to extracted ICIJ CSVs (default: E:\\CapitolGraph\\data\\icij\\extracted)
        persons_registry_path: Path to persons-registry.json
        fuzzy_threshold: Minimum rapidfuzz score (0-100) for fuzzy matching
        min_name_length: Skip names shorter than this
        traverse_relationships: Whether to follow officer→entity relationships
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    data_dir = icij_data_dir or Path(r"E:\CapitolGraph\data\icij\extracted")
    if not data_dir.exists():
        console.print(f"[red]ICIJ data directory not found: {data_dir}[/red]")
        console.print("Download from https://offshoreleaks.icij.org/pages/database")
        return

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

    console.print("[bold]ICIJ Offshore Leaks Cross-Reference[/bold]")
    console.print(f"ICIJ data: [cyan]{data_dir}[/cyan]")
    console.print(f"Persons to check: [cyan]{len(persons_list)}[/cyan]")
    console.print(f"Fuzzy threshold: [cyan]{fuzzy_threshold}[/cyan]")
    console.print(f"Traverse relationships: [cyan]{traverse_relationships}[/cyan]")
    console.print()

    # Phase 1: Build name indexes from CSVs
    console.print("[bold]Phase 1:[/bold] Building name indexes from CSVs...")

    entities_index, entities_count = _build_name_index(data_dir / "nodes-entities.csv", "entity")
    officers_index, officers_count = _build_name_index(data_dir / "nodes-officers.csv", "officer")
    intermediaries_index, intermediaries_count = _build_name_index(
        data_dir / "nodes-intermediaries.csv", "intermediary"
    )

    total_nodes = entities_count + officers_count + intermediaries_count
    console.print(f"  Entities: [cyan]{entities_count:,}[/cyan]")
    console.print(f"  Officers: [cyan]{officers_count:,}[/cyan]")
    console.print(f"  Intermediaries: [cyan]{intermediaries_count:,}[/cyan]")
    console.print(f"  Total ICIJ nodes: [cyan]{total_nodes:,}[/cyan]")
    console.print()

    # Build name frequency counts for common name protection
    name_counts: dict[str, int] = defaultdict(int)
    for idx in [entities_index, officers_index, intermediaries_index]:
        for name, rows in idx.items():
            name_counts[name] += len(rows)

    # Phase 2: Match persons against all three node types
    console.print("[bold]Phase 2:[/bold] Matching persons against ICIJ data...")

    all_matches: list[dict] = []
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        MofNCompleteColumn(),
        TimeRemainingColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("Matching...", total=3)

        progress.update(task, description="Matching against entities...")
        entity_matches = _match_persons(
            persons_list, entities_index, "entity",
            fuzzy_threshold=fuzzy_threshold,
            min_name_length=min_name_length,
            name_counts=dict(name_counts),
        )
        all_matches.extend(entity_matches)
        progress.advance(task)

        progress.update(task, description="Matching against officers...")
        officer_matches = _match_persons(
            persons_list, officers_index, "officer",
            fuzzy_threshold=fuzzy_threshold,
            min_name_length=min_name_length,
            name_counts=dict(name_counts),
        )
        all_matches.extend(officer_matches)
        progress.advance(task)

        progress.update(task, description="Matching against intermediaries...")
        intermediary_matches = _match_persons(
            persons_list, intermediaries_index, "intermediary",
            fuzzy_threshold=fuzzy_threshold,
            min_name_length=min_name_length,
            name_counts=dict(name_counts),
        )
        all_matches.extend(intermediary_matches)
        progress.advance(task)

    console.print(f"  Total matches: [cyan]{len(all_matches)}[/cyan]")
    console.print()

    # Phase 3: Relationship traversal (optional)
    chains: list[dict] = []
    if traverse_relationships and all_matches:
        console.print("[bold]Phase 3:[/bold] Traversing relationships...")

        relationships = _load_relationships(data_dir / "relationships.csv")
        console.print(f"  Relationships loaded: [cyan]{sum(len(v) for v in relationships.values()):,}[/cyan]")

        # Build entity index by node_id for traversal
        entity_by_id: dict[str, dict] = {}
        entity_csv = data_dir / "nodes-entities.csv"
        if entity_csv.exists():
            with open(entity_csv, encoding="utf-8", errors="replace") as f:
                for row in csv.DictReader(f):
                    nid = row.get("node_id", row.get("_id", ""))
                    if nid:
                        entity_by_id[nid] = row

        # Get matched officer/intermediary node IDs
        matched_ids = set()
        person_map: dict[str, tuple[str, str]] = {}
        for m in all_matches:
            if m["icij_type"] in ("officer", "intermediary"):
                nid = m["icij_node_id"]
                matched_ids.add(nid)
                person_map[nid] = (m["person_id"], m["person_name"])

        if matched_ids:
            chains = _traverse_relationships(
                matched_ids, relationships, entity_by_id, person_map, max_depth=2
            )

            # Fill in officer names from matches
            officer_names: dict[str, str] = {}
            for m in all_matches:
                if m["icij_node_id"]:
                    officer_names[m["icij_node_id"]] = m["icij_name"]
            for chain in chains:
                if not chain["officer_name"] and chain["officer_node_id"] in officer_names:
                    chain["officer_name"] = officer_names[chain["officer_node_id"]]

        console.print(f"  Relationship chains found: [cyan]{len(chains)}[/cyan]")
        console.print()

    # Group results by person
    person_results: dict[str, dict] = {}
    for m in all_matches:
        pid = m["person_id"]
        if pid not in person_results:
            person_results[pid] = {
                "person_id": pid,
                "person_name": m["person_name"],
                "matches": [],
                "chains": [],
                "best_score": 0.0,
                "checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
        person_results[pid]["matches"].append(m)
        person_results[pid]["best_score"] = max(
            person_results[pid]["best_score"], m["match_score"]
        )

    for chain in chains:
        pid = chain["source_person_id"]
        if pid in person_results:
            person_results[pid]["chains"].append(chain)

    # Save results
    unique_persons_matched = len(person_results)
    output_file = output_dir / "icij-crossref-results.json"

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(
            {
                "metadata": {
                    "source": "ICIJ Offshore Leaks Database",
                    "data_dir": str(data_dir),
                    "total_icij_nodes": total_nodes,
                    "total_persons_checked": len(persons_list),
                    "total_matches": len(all_matches),
                    "unique_persons_matched": unique_persons_matched,
                    "relationship_chains": len(chains),
                    "fuzzy_threshold": fuzzy_threshold,
                    "checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                },
                "results": list(person_results.values()),
            },
            f,
            indent=2,
            default=str,
        )

    console.print(f"[green]Results saved to {output_file}[/green]")
    console.print()

    # Summary table
    table = Table(title="ICIJ Offshore Leaks Cross-Reference Summary")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="bold")
    table.add_row("ICIJ nodes indexed", f"{total_nodes:,}")
    table.add_row("Persons checked", str(len(persons_list)))
    table.add_row("Total matches", str(len(all_matches)))
    table.add_row("Unique persons matched", str(unique_persons_matched))
    table.add_row("  - Entity matches", str(len(entity_matches)))
    table.add_row("  - Officer matches", str(len(officer_matches)))
    table.add_row("  - Intermediary matches", str(len(intermediary_matches)))
    table.add_row("Relationship chains", str(len(chains)))
    console.print(table)

    # Show top matches
    if person_results:
        console.print()
        match_table = Table(title="Top Matches")
        match_table.add_column("Person", style="white")
        match_table.add_column("ICIJ Name", style="cyan")
        match_table.add_column("Type", style="dim")
        match_table.add_column("Dataset", style="yellow")
        match_table.add_column("Score", style="green")
        match_table.add_column("Method", style="dim")

        top = sorted(person_results.values(), key=lambda x: x["best_score"], reverse=True)[:25]
        for pr in top:
            best_match = max(pr["matches"], key=lambda m: m["match_score"])
            match_table.add_row(
                pr["person_name"],
                best_match["icij_name"],
                best_match["icij_type"],
                best_match["icij_dataset"],
                f"{best_match['match_score']:.2f}",
                best_match["match_method"],
            )

        console.print(match_table)
