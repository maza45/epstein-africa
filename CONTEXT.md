# Epstein Africa — Project Context

## Project Overview

**Epstein Africa** is a public interest journalism database documenting Jeffrey Epstein's documented connections to the African continent, built from releases under the DOJ Epstein Files Transparency Act.

The goal is a searchable, public-facing tool for journalists, researchers, and the general public — free, ad-free, and open source.

---

## Creator

- Solo developer, MSc Computer Science
- 5 years background in finance automation
- Based in Paris

---

## Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Frontend    | Next.js                           |
| Hosting     | Vercel                            |
| CDN/Proxy   | Cloudflare                        |
| Database    | PostgreSQL or SQLite (TBD)        |

---

## Data Collected

### Emails
- **769 Africa-related emails** filtered from the 1.78M email Jmail parquet dataset

### Data Locations
| Dataset         | Path                                              |
|-----------------|---------------------------------------------------|
| Africa emails   | `~/Epstein-Pipeline/data/jmail/africa.parquet`    |
| Full email set  | `~/Epstein-Pipeline/data/jmail/emails-slim.parquet` |
| People data     | `~/Epstein-Pipeline/data/jmail/people.parquet`    |

### Key Countries
Kenya, Nigeria, Ivory Coast, South Africa, Senegal, Zimbabwe, Somalia, Ethiopia, Tanzania, Ghana

### Key Persons Identified
| Name               | Notes                          |
|--------------------|--------------------------------|
| Sultan Bin Sulayem | 76 emails — highest volume     |
| Jeffrey Epstein    | Central subject                |
| Peggy Siegal       | Recurring contact              |
| Jide Zeitlin       | Recurring contact              |
| Lesley Groff       | Epstein assistant              |
| Miasha             | Recurring contact              |

### Key Threads
- Kenya visa arrangements (2009)
- Nigeria port deals (2018)
- Somaliland recognition documents
- Africa trips referencing Robert Mugabe and Dangote

---

## MVP Scope

- Searchable email table
- ~15 person profiles
- Simple network graph
- Country filter
- Links to original DOJ source documents

---

## Current Status

Data pipeline complete. Ready to begin frontend development.

---

## Next Steps

1. Set up Next.js project structure
2. Create SQLite database and import `africa.parquet`
3. Build searchable email table component
4. Build person profile pages
5. Build network graph
6. Deploy to Vercel

---

## Source

Data sourced from DOJ Epstein Files Transparency Act public releases.
