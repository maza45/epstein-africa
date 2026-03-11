"""Import FEC political donation results into Neon Postgres.

Reads the fec-results.json from the downloader and writes donation
records to the political_donations table and updates person records.
"""

from __future__ import annotations

import json
from pathlib import Path

import psycopg
from rich.console import Console
from rich.table import Table

console = Console()


def _ensure_fec_tables(conn: psycopg.Connection) -> None:
    """Create the political_donations table if it doesn't exist."""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS political_donations (
            id SERIAL PRIMARY KEY,
            person_id TEXT NOT NULL,
            person_name TEXT NOT NULL,
            fec_committee_id TEXT NOT NULL,
            fec_committee_name TEXT,
            candidate_name TEXT,
            candidate_party TEXT,
            candidate_office TEXT,
            candidate_state TEXT,
            contributor_name TEXT NOT NULL,
            contributor_city TEXT,
            contributor_state TEXT,
            contributor_zip TEXT,
            contributor_employer TEXT,
            contributor_occupation TEXT,
            amount BIGINT NOT NULL,
            date DATE,
            election_cycle TEXT,
            receipt_type TEXT,
            fec_transaction_id TEXT,
            match_score REAL NOT NULL DEFAULT 0.0,
            match_method TEXT DEFAULT 'exact',
            verified BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(person_id, fec_transaction_id)
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_pol_donations_person
        ON political_donations(person_id)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_pol_donations_candidate
        ON political_donations(candidate_name)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_pol_donations_date
        ON political_donations(date)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_pol_donations_party
        ON political_donations(candidate_party)
    """)

    # Add columns to persons table if they don't exist
    for col, dtype, default in [
        ("fec_donor", "BOOLEAN", "false"),
        ("fec_total_donated", "BIGINT", "0"),
        ("fec_checked_at", "TIMESTAMPTZ", "NULL"),
    ]:
        try:
            conn.execute(
                f"ALTER TABLE persons ADD COLUMN IF NOT EXISTS {col} {dtype} DEFAULT {default}"
            )
        except Exception:
            pass


def import_fec(
    results_path: Path,
    database_url: str,
    *,
    min_score: float = 0.85,
    min_amount: int = 200,
) -> None:
    """Import FEC political donation results into Neon Postgres.

    Args:
        results_path: Path to fec-results.json
        database_url: Neon Postgres connection URL
        min_score: Minimum match score to import (0-1)
        min_amount: Minimum contribution amount in cents to import
    """
    if not results_path.exists():
        console.print(f"[red]Results file not found: {results_path}[/red]")
        return

    with open(results_path, encoding="utf-8") as f:
        data = json.load(f)

    results = data.get("results", [])
    metadata = data.get("metadata", {})

    console.print("[bold]Importing FEC Political Donation Results[/bold]")
    console.print(f"Results file: [cyan]{results_path}[/cyan]")
    console.print(f"Persons checked: [cyan]{metadata.get('total_persons_checked', len(results))}[/cyan]")
    console.print(f"Min import score: [cyan]{min_score}[/cyan]")
    console.print(f"Min amount: [cyan]${min_amount / 100:.2f}[/cyan]")
    console.print()

    imported_donations = 0
    updated_persons = 0
    skipped_low_score = 0
    skipped_low_amount = 0
    errors = 0

    with psycopg.connect(database_url, autocommit=True) as conn:
        _ensure_fec_tables(conn)

        for result in results:
            person_id = result.get("person_id", "")
            person_name = result.get("person_name", "")
            contributions = result.get("contributions", [])

            if not person_id or not contributions:
                continue

            person_total = 0
            person_count = 0

            for contrib in contributions:
                score = contrib.get("match_score", 0.0)
                amount = contrib.get("amount", 0)

                if score < min_score:
                    skipped_low_score += 1
                    continue
                if abs(amount) < min_amount:
                    skipped_low_amount += 1
                    continue

                transaction_id = str(contrib.get("transaction_id", ""))
                if not transaction_id:
                    continue

                try:
                    # Parse date safely
                    date_str = contrib.get("date", "")
                    date_val = date_str if date_str else None

                    conn.execute(
                        """
                        INSERT INTO political_donations
                            (person_id, person_name, fec_committee_id, fec_committee_name,
                             candidate_name, candidate_party, candidate_office, candidate_state,
                             contributor_name, contributor_city, contributor_state,
                             contributor_zip, contributor_employer, contributor_occupation,
                             amount, date, election_cycle, receipt_type,
                             fec_transaction_id, match_score, match_method)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (person_id, fec_transaction_id) DO UPDATE SET
                            candidate_name = EXCLUDED.candidate_name,
                            candidate_party = EXCLUDED.candidate_party,
                            candidate_office = EXCLUDED.candidate_office,
                            amount = EXCLUDED.amount,
                            match_score = EXCLUDED.match_score
                        """,
                        (
                            person_id,
                            person_name,
                            contrib.get("committee_id", ""),
                            contrib.get("committee_name", ""),
                            contrib.get("candidate_name", ""),
                            contrib.get("candidate_party", ""),
                            contrib.get("candidate_office", ""),
                            contrib.get("candidate_state", ""),
                            contrib.get("contributor_name", ""),
                            contrib.get("contributor_city", ""),
                            contrib.get("contributor_state", ""),
                            contrib.get("contributor_zip", ""),
                            contrib.get("contributor_employer", ""),
                            contrib.get("contributor_occupation", ""),
                            amount,
                            date_val,
                            contrib.get("election_cycle", ""),
                            contrib.get("receipt_type", ""),
                            transaction_id,
                            score,
                            contrib.get("match_method", "exact"),
                        ),
                    )
                    imported_donations += 1
                    person_total += amount
                    person_count += 1
                except Exception as e:
                    errors += 1
                    if errors <= 5:
                        console.print(f"[yellow]Warning: {e}[/yellow]")

            # Update person record
            if person_count > 0:
                try:
                    conn.execute(
                        """
                        UPDATE persons SET
                            fec_donor = true,
                            fec_total_donated = %s,
                            fec_checked_at = NOW()
                        WHERE id = %s OR slug = %s
                        """,
                        (person_total, person_id, person_id),
                    )
                    updated_persons += 1
                except Exception:
                    pass

    console.print()

    # Summary
    table = Table(title="FEC Import Summary")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="bold")
    table.add_row("Donation records imported", str(imported_donations))
    table.add_row("Person records updated", str(updated_persons))
    table.add_row("Skipped (low score)", str(skipped_low_score))
    table.add_row("Skipped (low amount)", str(skipped_low_amount))
    table.add_row("Errors", str(errors))
    console.print(table)

    console.print(f"\n[green]Import complete.[/green]")
