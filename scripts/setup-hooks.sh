#!/bin/bash
# setup-hooks.sh — install the project's git hooks for this clone.
#
# Run this once after cloning the repo. It points git at scripts/git-hooks/
# (which is tracked in the repo) instead of the default .git/hooks/ (which
# is per-clone and would otherwise miss the project's pre-commit verifier).
#
# The pre-commit hook itself runs scripts/verify-stories.js when
# web/lib/stories.js or web/lib/people.js are staged. Reporter only:
# checks that every cited email_id exists, every body quote appears in
# its cited row, and every news_links URL resolves. Blocks the commit
# on any error. No auto-fix, no audit log.
#
# Why this exists as a separate file (rather than living in .git/hooks):
# .git/ is per-clone and not tracked by git, so any hook installed there
# would have to be reinstalled after every fresh clone. From 2026-04-03 to
# 2026-04-06 the project's pre-commit hook was effectively dead because
# (a) it lived only in .git/hooks/ on one machine, and (b) it had two
# parser bugs that prevented the audit-regression check from ever firing.
# Both are now fixed and the hook is tracked here.
#
# Idempotent — safe to run multiple times.

set -euo pipefail

# Resolve repo root from this script's location, so it works whether
# you run it as `bash scripts/setup-hooks.sh` or as `./scripts/setup-hooks.sh`.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

if [ ! -f scripts/git-hooks/pre-commit ]; then
    echo "ERROR: scripts/git-hooks/pre-commit not found in $REPO_ROOT" >&2
    echo "       Make sure you're running this from inside the Epstein-Pipeline repo." >&2
    exit 1
fi

git config core.hooksPath scripts/git-hooks
echo "Installed: git core.hooksPath -> scripts/git-hooks"
echo "Active hooks:"
ls -1 scripts/git-hooks/
