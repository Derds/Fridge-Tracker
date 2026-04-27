#!/usr/bin/env bash
set -euo pipefail

# ── Fridge Inventory — local dev setup ─────────────────────────────────────

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}▶${NC} $*"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $*"; }
error()   { echo -e "${RED}✗${NC}  $*" >&2; exit 1; }

# ── Check Node ──────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  error "Node.js not found. Install it from https://nodejs.org (v18 or newer)."
fi

NODE_VERSION=$(node -e "process.stdout.write(process.versions.node)")
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  error "Node.js v18+ required. You have v${NODE_VERSION}."
fi
info "Node.js v${NODE_VERSION} ✓"

# ── Check npm ───────────────────────────────────────────────────────────────
if ! command -v npm &>/dev/null; then
  error "npm not found. It should ship with Node.js."
fi
info "npm $(npm --version) ✓"

# ── Install dependencies ─────────────────────────────────────────────────────
# --legacy-peer-deps is required because vite-plugin-pwa hasn't yet declared
# support for Vite 8 in its peer deps, even though it works fine.
info "Installing dependencies…"
npm install --legacy-peer-deps

# ── Security audit ──────────────────────────────────────────────────────────
VULNS=$(npm audit --json 2>/dev/null | node -e "
  let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{
    try { const r=JSON.parse(d); process.stdout.write(String(r.metadata?.vulnerabilities?.total ?? 0)); }
    catch { process.stdout.write('?'); }
  })
" 2>/dev/null || echo "?")

if [ "$VULNS" = "0" ]; then
  info "Security audit: 0 vulnerabilities ✓"
elif [ "$VULNS" = "?" ]; then
  warn "Could not parse audit output — run 'npm audit' manually to check."
else
  warn "${VULNS} vulnerabilities found. Run 'npm audit' for details."
fi

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}✓ Setup complete.${NC}"
echo ""
echo "  Start dev server:   npm run dev"
echo "  Production build:   npm run build"
echo "  Preview build:      npm run preview"
echo ""
