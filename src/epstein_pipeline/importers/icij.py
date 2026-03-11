"""Import ICIJ Offshore Leaks cross-reference results into Neon Postgres.

Reads the icij-crossref-results.json from the downloader and writes
matches and relationship chains to icij_matches and icij_relationships tables.
"""

from __future__ import annotations

import json
from pathlib import Path

import psycopg
from rich.console import Console
from rich.table import Table

console = Console()


def _ensure_icij_tables(conn: psycopg.Connection) -> None:
    """Create/update the icij_matches and icij_relationships tables."""
    # The icij_matches table may already exist from the old cross-ref script.
    # Add new optional columns if they don't exist.
    conn.execute("""
        CREATE TABLE IF NOT EXISTS icij_matches (
            id SERIAL PRIMARY KEY,
            source_type TEXT NOT NULL DEFAULT 'person',
            source_id TEXT NOT NULL,
            icij_node_id TEXT NOT NULL,
            icij_name TEXT NOT NULL,
            icij_type TEXT NOT NULL DEFAULT 'entity',
            icij_jurisdiction TEXT,
            icij_country_codes TEXT,
            icij_dataset TEXT,
            match_score FLOAT NOT NULL DEFAULT 0.0,
            match_method TEXT DEFAULT 'fuzzy',
            verified BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(source_type, source_id, icij_node_id)
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_icij_matches_source
        ON icij_matches(source_id)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_icij_matches_score
        ON icij_matches(match_score) WHERE match_score >= 0.9
    """)

    # Add optional columns that may not exist on older tables
    for col, dtype, default in [
        ("incorporation_date", "TEXT", "NULL"),
        ("company_type", "TEXT", "''"),
        ("address", "TEXT", "''"),
    ]:
        try:
            conn.execute(
                f"ALTER TABLE icij_matches ADD COLUMN IF NOT EXISTS {col} {dtype} DEFAULT {default}"
            )
        except Exception:
            pass

    # New relationships table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS icij_relationships (
            id SERIAL PRIMARY KEY,
            source_person_id TEXT NOT NULL,
            source_person_name TEXT NOT NULL,
            officer_node_id TEXT NOT NULL,
            officer_name TEXT NOT NULL,
            entity_node_id TEXT NOT NULL,
            entity_name TEXT NOT NULL,
            relationship_type TEXT NOT NULL,
            entity_jurisdiction TEXT,
            entity_country_codes TEXT,
            dataset TEXT,
            depth INTEGER DEFAULT 1,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(source_person_id, officer_node_id, entity_node_id)
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_icij_rel_person
        ON icij_relationships(source_person_id)
    """)


def import_icij(
    results_path: Path,
    database_url: str,
    *,
    min_score: float = 0.75,
    clear_existing: bool = False,
) -> None:
    """Import ICIJ cross-reference results into Neon Postgres.

    Args:
        results_path: Path to icij-crossref-results.json
        database_url: Neon Postgres connection URL
        min_score: Minimum match score to import (0-1)
        clear_existing: If True, truncate tables before importing
    """
    if not results_path.exists():
        console.print(f"[red]Results file not found: {results_path}[/red]")
        return

    with open(results_path, encoding="utf-8") as f:
        data = json.load(f)

    results = data.get("results", [])
    metadata = data.get("metadata", {})

    console.print("[bold]Importing ICIJ Offshore Leaks Results[/bold]")
    console.print(f"Results file: [cyan]{results_path}[/cyan]")
    console.print(f"Persons with matches: [cyan]{len(results)}[/cyan]")
    console.print(f"Total matches: [cyan]{metadata.get('total_matches', '?')}[/cyan]")
    console.print(f"Min import score: [cyan]{min_score}[/cyan]")
    console.print()

    imported_matches = 0
    imported_chains = 0
    skipped_low_score = 0
    updated_persons = 0
    errors = 0

    with psycopg.connect(database_url, autocommit=True) as conn:
        _ensure_icij_tables(conn)

        if clear_existing:
            conn.execute("DELETE FROM icij_matches")
            try:
                conn.execute("DELETE FROM icij_relationships")
            except Exception:
                pass
            console.print("[yellow]Cleared existing ICIJ data[/yellow]")

        for result in results:
            person_id = result.get("person_id", "")
            person_name = result.get("person_name", "")
            matches = result.get("matches", [])
            chains = result.get("chains", [])

            if not person_id:
                continue

            # Import matches
            for match in matches:
                score = match.get("match_score", 0.0)
                if score < min_score:
                    skipped_low_score += 1
                    continue

                try:
                    conn.execute(
                        """
                        INSERT INTO icij_matches
                            (source_type, source_id, source_name, icij_node_id, icij_name, icij_type,
                             icij_jurisdiction, icij_country_codes, icij_source_id, icij_dataset,
                             match_score, match_method, incorporation_date, company_type, address)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (source_type, source_id, icij_node_id) DO UPDATE SET
                            source_name = EXCLUDED.source_name,
                            icij_name = EXCLUDED.icij_name,
                            icij_type = EXCLUDED.icij_type,
                            icij_jurisdiction = EXCLUDED.icij_jurisdiction,
                            icij_country_codes = EXCLUDED.icij_country_codes,
                            icij_dataset = EXCLUDED.icij_dataset,
                            match_score = EXCLUDED.match_score,
                            match_method = EXCLUDED.match_method,
                            incorporation_date = EXCLUDED.incorporation_date,
                            company_type = EXCLUDED.company_type,
                            address = EXCLUDED.address
                        """,
                        (
                            "person",
                            person_id,
                            person_name,
                            match.get("icij_node_id", ""),
                            match.get("icij_name", ""),
                            match.get("icij_type", "entity"),
                            match.get("icij_jurisdiction", ""),
                            match.get("icij_country_codes", ""),
                            match.get("icij_node_id", ""),  # icij_source_id = node_id
                            match.get("icij_dataset", ""),
                            score,
                            match.get("match_method", "fuzzy"),
                            match.get("incorporation_date"),
                            match.get("company_type", ""),
                            match.get("address", ""),
                        ),
                    )
                    imported_matches += 1
                except Exception as e:
                    errors += 1
                    if errors <= 5:
                        console.print(f"[yellow]Warning (match): {e}[/yellow]")

            # Import relationship chains
            for chain in chains:
                try:
                    conn.execute(
                        """
                        INSERT INTO icij_relationships
                            (source_person_id, source_person_name, officer_node_id,
                             officer_name, entity_node_id, entity_name,
                             relationship_type, entity_jurisdiction,
                             entity_country_codes, dataset, depth)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (source_person_id, officer_node_id, entity_node_id) DO UPDATE SET
                            officer_name = EXCLUDED.officer_name,
                            entity_name = EXCLUDED.entity_name,
                            relationship_type = EXCLUDED.relationship_type,
                            entity_jurisdiction = EXCLUDED.entity_jurisdiction,
                            entity_country_codes = EXCLUDED.entity_country_codes,
                            dataset = EXCLUDED.dataset,
                            depth = EXCLUDED.depth
                        """,
                        (
                            chain.get("source_person_id", ""),
                            chain.get("source_person_name", ""),
                            chain.get("officer_node_id", ""),
                            chain.get("officer_name", ""),
                            chain.get("entity_node_id", ""),
                            chain.get("entity_name", ""),
                            chain.get("relationship_type", ""),
                            chain.get("entity_jurisdiction", ""),
                            chain.get("entity_country_codes", ""),
                            chain.get("dataset", ""),
                            chain.get("depth", 1),
                        ),
                    )
                    imported_chains += 1
                except Exception as e:
                    errors += 1
                    if errors <= 10:
                        console.print(f"[yellow]Warning (chain): {e}[/yellow]")

    console.print()

    # Summary
    table = Table(title="ICIJ Import Summary")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="bold")
    table.add_row("Match records imported", str(imported_matches))
    table.add_row("Relationship chains imported", str(imported_chains))
    table.add_row("Skipped (low score)", str(skipped_low_score))
    table.add_row("Errors", str(errors))
    console.print(table)

    console.print(f"\n[green]Import complete.[/green]")
