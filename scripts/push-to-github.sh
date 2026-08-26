#!/usr/bin/env bash
# Push Voluntrip AI to GitHub in modular commits.
# Run from project root: bash scripts/push-to-github.sh
set -euo pipefail

cd "$(dirname "$0")/.."

# Never commit secrets
if git check-ignore -q .env.local 2>/dev/null || [[ ! -f .env.local ]]; then
  :
else
  echo "WARNING: .env.local should be gitignored"
fi

# Ensure we are in a git repo for THIS project (not a parent home repo)
if [[ ! -d .git ]]; then
  git init
fi

git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/VIVIANAPLATA16/voluntrip-ai.git
git branch -M main

# 1. Motor financiero + local-first + módulos principales
git add \
  src/lib/finance/ \
  src/lib/db/ \
  src/lib/demo/ \
  src/lib/constants.ts \
  src/lib/id.ts \
  src/lib/utils.ts \
  src/types/ \
  src/store/ \
  src/app/onboarding/ \
  src/app/app/pockets/ \
  src/app/app/goals/ \
  src/app/app/activity/ \
  src/app/app/page.tsx \
  src/app/app/layout.tsx \
  src/app/page.tsx \
  src/app/layout.tsx \
  src/app/globals.css \
  2>/dev/null || true
git add src/lib/finance/ src/app/onboarding/ src/app/app/pockets/ src/app/app/goals/ src/app/app/activity/ || true
if ! git diff --cached --quiet 2>/dev/null; then
  git commit -m "$(cat <<'EOF'
feat(core): implement DRS financial engine, local-first storage, and main app modules
EOF
)"
else
  echo "Skip commit 1: nothing staged"
fi

# 2. NAVI
git add src/app/api/navi/ src/app/app/navi/ src/lib/agent/ src/lib/ai/ || true
if ! git diff --cached --quiet 2>/dev/null; then
  git commit -m "$(cat <<'EOF'
feat(agent): integrate NAVI assistant with Azure OpenAI gpt-4o and custom prompt tools
EOF
)"
else
  echo "Skip commit 2: nothing staged"
fi

# 3. i18n + UI
git add public/ src/components/ src/lib/i18n/ src/app/globals.css || true
if ! git diff --cached --quiet 2>/dev/null; then
  git commit -m "$(cat <<'EOF'
fix(ui): enforce i18n support (EN/ES/PT) across all pages and fix layout overflow bugs
EOF
)"
else
  echo "Skip commit 3: nothing staged"
fi

# 4. Supabase Auth & Sync
git add supabase/ src/lib/supabase/ src/lib/sync/ src/app/app/trip/ src/app/auth/ .env.example || true
if ! git diff --cached --quiet 2>/dev/null; then
  git commit -m "$(cat <<'EOF'
feat(auth): configure Supabase database schema, magic link backup flow, and trip data sync
EOF
)"
else
  echo "Skip commit 4: nothing staged"
fi

# 5. Rest (never .env.local)
git add .
git reset HEAD -- .env.local 2>/dev/null || true
if ! git diff --cached --quiet 2>/dev/null; then
  git commit -m "$(cat <<'EOF'
chore: include build scripts, tests configuration, and final production pre-flight checks
EOF
)"
else
  echo "Skip commit 5: nothing staged"
fi

git push -u origin main

echo ""
echo "Done. Remote:"
git remote -v
echo "Latest commits:"
git log --oneline -8
