#!/usr/bin/env bash
# Run in the read-only gate job, before the publishing job can start.
set -euo pipefail
: "${DEFAULT_BRANCH:?default branch is required}"
: "${GITHUB_SHA:?release commit is required}"
git check-ref-format "refs/heads/$DEFAULT_BRANCH"
# checkout fetch-depth: 0 fetches all branches; fail closed if the ref is absent.
default_ref="refs/remotes/origin/$DEFAULT_BRANCH"
git rev-parse --verify "${default_ref}^{commit}" >/dev/null
git rev-parse --verify "${GITHUB_SHA}^{commit}" >/dev/null
git merge-base --is-ancestor "$GITHUB_SHA" "$default_ref"
