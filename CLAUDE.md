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

1. **Open Range** - Earliest non-SB position each hand can open from (UTG through BTN). Color = position color. One grid per stack size. SB is excluded here and lives in its own tab.
2. **SB Open** - Dedicated view for SB's RFI range. Available at 15BB (call / all-in) and 100BB (limp / raise / raise_bluff). Not shown at 25/40BB where SB uses the standard RFI structure.
3. **Facing Charts** - Specific situation charts. Two categories: `상대 오픈 대응` (Facing RFI / BvB) and `내 오픈 후 대응` (RFI vs Allin at 15BB, RFI vs 3bet at 100BB). Color = action color. Dropdown selectors for hero/villain; the second category is filtered out at stacks where no matching charts exist.
4. **Quiz / Stats** - Practice quiz against chart data, plus stats (profile radar, accuracy, wrong list, GTO-vs-your-answer compare grid).

### Key Source Files

- `src/constants.ts` - ACTION_COLORS (16 types), POSITION_COLORS (8 positions), RANKS, OPENER_TO_3BETTOR mapping
- `src/utils/hand.ts` - getHandName, getCombos, buildHandAction, buildOpenRangeData
- `src/utils/chartGroup.ts` - Chart name → group classification (RFI/Facing RFI/RFI vs All-In/RFI vs 3bet/BvB)
- `src/components/RangeGrid.tsx` - 13x13 grid component
- `src/pages/OpenRangePage.tsx` - Open Range view
- `src/pages/FacingPage.tsx` - Facing Charts view (includes 100BB RFI vs 3bet dual-dropdown UI)

### 100BB Special Cases

- threebet split into value/bluff, plus "RFI vs 3bet" category (27 reachable charts; `SB RFI vs BB 3bet` is intentionally filtered in `scenarioMap.ts`)
- SB RFI has raise / raise_bluff / limp — rendered in the dedicated SB Open tab, NOT in the main Open Range
- "RFI vs 3bet" UI: opener → 3bettor dropdown pair, villain filtered by `OPENER_TO_3BETTOR`

### 15BB Special Cases

- "RFI vs Allin" exists as both specific ("X RFI vs Y Allin") and generic ("X RFI vs Allin") forms. The generic form expands villain to every position after the opener.
- SB Open tab shows the push/fold range: call vs all-in actions.

## Validation

Combo totals (must match exactly; total = 1326 per stack).

**Open Range view** (UTG → BTN, SB/BB excluded):
| Stack | open | fold |
|---|---:|---:|
| 15BB  | 518 | 808 |
| 25BB  | 614 | 712 |
| 40BB  | 674 | 652 |
| 100BB | 678 | 648 |

**SB Open view** (SB's RFI only; tab exists at 15BB and 100BB only):
| Stack | open (breakdown) | fold |
|---|---:|---:|
| 15BB  | 1110 (call 804 + allIn 306) | 216 |
| 100BB | 934 (limp 644 + raise 118 + raise_bluff 172) | 392 |

Historical note: prior revisions of this doc listed combined totals (e.g. 1020/306 at 15BB, 934/392 at 100BB) that predated the Open Range / SB Open tab split. Those numbers are stale; use the tables above.

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
