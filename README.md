# The Big Board V2

NFL Pick'em League Application - Complete rebuild with modern stack.

## Tech Stack

- **Frontend**: Next.js 16, React, Material UI
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **Deployment**: Vercel
- **Automation**: GitHub Actions

## Project Status

**Last Updated**: December 8, 2025

### Completed Epics

| Epic | Description | Status |
|------|-------------|--------|
| **Epic 1** | Foundation & Auth | ✅ Complete |
| **Epic 2** | League & Membership | ✅ Complete |
| **Epic 3** | Core Picks | ✅ Complete |
| **Epic 4** | Scoring & Standings | ✅ Complete |
| **Epic 5** | Auto-Assign | ✅ Complete |
| **Epic 6** | Wrinkles | ✅ Complete |
| **Epic 7** | Playoffs | ✅ Complete |

### In Progress

| Epic | Description | Status |
|------|-------------|--------|
| **Epic 8** | Admin Dashboard Polish | 🔄 Partial - needs AppShell wrapper |
| **Epic 9** | Social & Notifications | ⏳ Not started |
| **Epic 10** | Migration & Launch | ⏳ Not started |

### Recent Session (Dec 7-8, 2025)

**Epic 7: Playoffs - COMPLETE**
- Database schema (playoff_settings_v2, playoff_rounds_v2, playoff_participants_v2, playoff_picks_v2)
- Snake draft unlock scheduling (3-hour intervals, 8pm-9am sleep mode)
- Playoff picks API with availability checking and swap limits
- Playoff picks UI with timers and game selection
- Round initialization API (Week 17 semifinals, Week 18 championship)
- Transition processing API for automated week-to-week advancement
- GitHub Action for nightly transition processing
- Admin UI for enabling playoffs and manual controls

**Scoring System**
- Created `/api/scoring` endpoint for manual scoring runs
- Added Supabase trigger `score_picks_on_game_final()` for automatic scoring when games complete
- Scoring happens instantly when ESPN refresh updates game status to FINAL

**Header/Navigation Consistency**
- AppShell now self-loads user/league data when props not provided
- Updated pages to use AppShell wrapper:
  - ✅ Home page (page.tsx)
  - ✅ Picks page
  - ✅ Playoffs page
  - ✅ Profile page
  - 🔄 Admin pages (still need AppShell)

### Key Features

**Regular Season (Weeks 1-16)**
- 2 picks per week
- Each team can only be used once per season
- Points = winning team's score
- Wrinkles for bonus picks

**Playoffs (Weeks 17-18)**
- Top 4 advance to playoffs
- Snake draft pick order based on seed
- Week 17: Semifinals (1-1-2-3-4-1-2-3-4)
- Week 18: Championship (1-2-1-2-1-2-1-2)
- 3-hour unlock intervals with overnight sleep mode
- 1 swap per hour after draft completes
- SNF tiebreaker game for championship

### Database Tables (V2)

**Core Tables**
- `profiles` - User profiles
- `leagues_v2` - League definitions
- `league_seasons_v2` - Season instances
- `league_season_participants_v2` - Memberships
- `picks_v2` - Regular season picks
- `games` - NFL schedule/scores
- `teams` - NFL teams

**Wrinkles Tables**
- `wrinkles_v2` - Bonus pick definitions
- `wrinkle_picks_v2` - User wrinkle selections

**Playoff Tables**
- `playoff_settings_v2` - League playoff config
- `playoff_rounds_v2` - Round definitions
- `playoff_participants_v2` - Playoff seeds
- `playoff_picks_v2` - Playoff picks

### API Routes

**Picks**
- `POST /api/scoring` - Manual scoring run

**Playoffs**
- `GET/POST /api/playoffs/settings` - Playoff settings
- `POST /api/playoffs/initialize` - Initialize round
- `GET/POST/DELETE /api/playoffs/picks` - Playoff picks
- `POST /api/playoffs/transition` - Process transitions

**Auto-Assign**
- `POST /api/auto-assign` - Auto-assign missed picks

### GitHub Actions

- `playoff-transitions.yml` - Nightly at 2am EST
- ESPN score refresh (existing from V1)

### Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PLAYOFF_TRANSITION_SECRET= (optional)
```

### Local Development
```bash
npm install
npm run dev
```

### Remaining Work

1. **Admin pages** - Add AppShell wrapper to admin/page.tsx and admin/wrinkles/page.tsx
2. **Epic 8: Admin Polish** - Unified admin dashboard, member management
3. **Epic 9: Notifications** - In-app alerts, activity feed
4. **Epic 10: Migration** - V1 data migration, production launch
5. **Next.js middleware deprecation** - Convert to proxy pattern before launch

### Notes

- Middleware shows deprecation warning in Next.js 16 - needs conversion to "proxy" pattern
- Public routes for automated APIs: `/api/scoring`, `/api/playoffs/transition`
- AppShell self-loads league data, so pages only need `<AppShell>{content}</AppShell>`
