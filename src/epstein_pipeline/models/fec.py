"""Dataclass models for FEC political donations cross-referencing."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class FECContribution:
    """Single FEC Schedule A contribution record."""

    transaction_id: str
    contributor_name: str
    contributor_city: str = ""
    contributor_state: str = ""
    contributor_zip: str = ""
    contributor_employer: str = ""
    contributor_occupation: str = ""
    committee_id: str = ""
    committee_name: str = ""
    candidate_name: str = ""
    candidate_party: str = ""  # DEM, REP, LIB, GRE, etc.
    candidate_office: str = ""  # P, S, H
    candidate_state: str = ""
    amount: int = 0  # cents
    date: str = ""  # YYYY-MM-DD
    election_cycle: str = ""
    receipt_type: str = ""
    match_score: float = 0.0
    match_method: str = "exact"


@dataclass
class FECPersonResult:
    """All FEC contribution matches for one person."""

    person_id: str
    person_name: str
    contributions: list[FECContribution] = field(default_factory=list)
    total_amount: int = 0
    contribution_count: int = 0
    party_breakdown: dict[str, int] = field(default_factory=dict)  # party -> total cents
    cycle_breakdown: dict[str, int] = field(default_factory=dict)  # cycle -> total cents
    date_range: tuple[str, str] | None = None  # (earliest, latest)
    skipped_common_name: bool = False
    checked_at: str = ""
    error: str | None = None


@dataclass
class FECSearchResult:
    """Top-level output from an FEC cross-reference run."""

    total_persons_checked: int = 0
    total_donors_found: int = 0
    total_contributions: int = 0
    total_amount: int = 0
    skipped_common_names: int = 0
    checked_at: str = ""
    results: list[FECPersonResult] = field(default_factory=list)
