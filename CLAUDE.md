# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GTO (Game Theory Optimal) preflop charts visualization app for poker. Displays 13x13 hand grids showing optimal actions per position/stack depth. Korean UI. Deployed on GitHub Pages.

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS (via @tailwindcss/vite)
- No external charting libraries (grids are custom-built)
- GitHub Pages deployment via GitHub Actions

## Build & Dev Commands

```bash
npm install
npm run dev        # Vite dev server (base: /holdem-static-page/)
npm run build      # Production build → dist/
npm run preview    # Preview production build
```

## Architecture

### Data

- `public/gto-preflop-charts-all.json` (~170KB) - GTO preflop data for 4 stack sizes (15BB/25BB/40BB/100BB)
- Loaded via `fetch` at runtime (NOT imported directly)
- Structure: `json.data[stackSize][chartName][action] = string[]`
- Hands not present in a chart are treated as "fold"

### Views (tab-based, no router)

1. **Open Range** - Earliest position each hand can open from. Color = position color. One grid per stack size.
2. **Facing Charts** - Specific situation charts (RFI, Facing RFI, vs 3bet, BvB). Color = action color. Dropdown selectors for group and chart.

### Key Source Files

- `src/constants.ts` - ACTION_COLORS (16 types), POSITION_COLORS (8 positions), RANKS, OPENER_TO_3BETTOR mapping
- `src/utils/hand.ts` - getHandName, getCombos, buildHandAction, buildOpenRangeData
- `src/utils/chartGroup.ts` - Chart name → group classification (RFI/Facing RFI/RFI vs All-In/RFI vs 3bet/BvB)
- `src/components/RangeGrid.tsx` - 13x13 grid component
- `src/pages/OpenRangePage.tsx` - Open Range view
- `src/pages/FacingPage.tsx` - Facing Charts view (includes 100BB RFI vs 3bet dual-dropdown UI)

### 100BB Special Cases

- threebet split into value/bluff, plus "RFI vs 3bet" category (30 charts)
- SB RFI has raise/raise_bluff/limp (all count as "open" in Open Range)
- "RFI vs 3bet" UI: two dropdowns (opener → 3bettor with filtered mapping from OPENER_TO_3BETTOR)

## Validation

Open Range combo totals (must match exactly):
- 15BB: 1020 open / 306 fold
- 25BB: 1086 open / 240 fold
- 40BB: 1074 open / 252 fold
- 100BB: 934 open / 392 fold

Full validation data in `prompt.md` section 7.

## Deployment

**GitHub Pages** (primary):
- Workflow: `.github/workflows/deploy.yml`
- Vite `base: '/holdem-static-page/'` (subpath)
- Push to `main` triggers auto-deploy

**Vercel** (secondary):
- Config: `vercel.json` (framework=vite, buildCommand=`npm run build:vercel`)
- Root-domain serve → Vite `base` falls back to `/` when `VERCEL=1` is set
- Required env vars in Vercel dashboard: `DATA_KEY` (for `openssl` decrypt), `VITE_PASSWORD_HASH`
- Same source data (`public/gto-preflop-charts-all.json.enc`) decrypted at build
