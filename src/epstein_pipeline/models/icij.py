"""Dataclass models for ICIJ Offshore Leaks cross-referencing.

Maps nodes (entities, officers, intermediaries) and edges (relationships)
from the ICIJ Offshore Leaks database, plus match/traversal results for
cross-referencing Epstein-connected persons against offshore structures.
"""

from __future__ import annotations

from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# ICIJ node types (from CSV exports)
# ---------------------------------------------------------------------------


@dataclass
class ICIJEntity:
    """A node from nodes-entities.csv (company / trust / foundation)."""

    node_id: str = ""
    name: str = ""
    jurisdiction: str = ""
    country_codes: str = ""
    company_type: str = ""
    incorporation_date: str | None = None
    source_id: str = ""
    note: str = ""


@dataclass
class ICIJOfficer:
    """A node from nodes-officers.csv (person linked to an offshore entity)."""

    node_id: str = ""
    name: str = ""
    countries: str = ""
    country_codes: str = ""
    source_id: str = ""


@dataclass
class ICIJIntermediary:
    """A node from nodes-intermediaries.csv (agent / law firm / registered agent)."""

    node_id: str = ""
    name: str = ""
    countries: str = ""
    country_codes: str = ""
    source_id: str = ""


# ---------------------------------------------------------------------------
# ICIJ edge type
# ---------------------------------------------------------------------------


@dataclass
class ICIJRelationship:
    """An edge from relationships.csv linking two ICIJ nodes."""

    node_id_start: str = ""
    node_id_end: str = ""
    rel_type: str = ""
    source_id: str = ""


# ---------------------------------------------------------------------------
# Cross-reference results
# ---------------------------------------------------------------------------


@dataclass
class ICIJMatch:
    """A single cross-reference match between an Epstein person and an ICIJ node."""

    person_id: str = ""
    person_name: str = ""
    icij_node_id: str = ""
    icij_name: str = ""
    icij_type: str = ""  # "entity" | "officer" | "intermediary"
    icij_jurisdiction: str = ""
    icij_country_codes: str = ""
    icij_dataset: str = ""
    match_score: float = 0.0
    match_method: str = ""  # "exact" | "alias" | "fuzzy"
    incorporation_date: str | None = None
    company_type: str = ""
    address: str = ""


@dataclass
class ICIJRelationshipChain:
    """A traversal result linking a person through an officer to an entity."""

    source_person_id: str = ""
    source_person_name: str = ""
    officer_node_id: str = ""
    officer_name: str = ""
    entity_node_id: str = ""
    entity_name: str = ""
    relationship_type: str = ""
    entity_jurisdiction: str = ""
    entity_country_codes: str = ""
    dataset: str = ""
    depth: int = 1


@dataclass
class ICIJCrossRefResult:
    """Top-level result container for an ICIJ cross-reference lookup on a person."""

    person_id: str = ""
    person_name: str = ""
    matches: list[ICIJMatch] = field(default_factory=list)
    chains: list[ICIJRelationshipChain] = field(default_factory=list)
    best_score: float = 0.0
    checked_at: str = ""
    error: str | None = None
