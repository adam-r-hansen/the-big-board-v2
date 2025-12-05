# The Big Board V2.0 - Rebuild Planning Document

**Last Updated:** December 4, 2024  
**Target Start Date:** After Week 18 (Early January 2025)  
**Target Launch:** Week 1, 2025 NFL Season (Early September 2025)

---

## 🎯 Project Vision

**Primary Goal:** "Rock solid on day one, and then I can just sit back and enjoy the season"

### What This Means:
- Zero admin work during live weeks
- No authentication issues
- No "oh shit" moments
- Fast, polished, professional experience
- Mobile-first (99% of users)
- Desktop-optimized for power users

---

## 📊 Current State Assessment

### What's Working:
- ✅ Core pick'em mechanics (32 picks, weekly quotas, wrinkles)
- ✅ Playoff system (snake draft, automated unlocks)
- ✅ Dual authentication (magic links + password)
- ✅ Unified Supabase client architecture
- ✅ TeamCard component as universal standard
- ✅ Real-time score updates via GitHub Actions
- ✅ Theme-aware UI (light/dark mode support)

### What Needs Improvement:
- ❌ Long mobile scrolling (poor information hierarchy)
- ❌ Desktop layout underutilized (mobile-but-wider)
- ❌ Admin dashboard is disjointed (scattered utilities)
- ❌ Legacy code and inefficiencies throughout
- ❌ Database table confusion (league_members vs league_memberships)
- ❌ Scattered authentication implementations (before unification)

---

## 🎨 Design Direction: Material UI

**Decision:** Full Material UI (MUI) implementation for V2

### Why Material UI?
1. **Instant Polish** - Professional look out of the box
2. **Consistent Iconography** - Material Icons everywhere
3. **Elevation System** - Depth and visual hierarchy
4. **Mobile Optimized** - Built for touch interfaces
5. **Dark Mode Native** - ThemeProvider makes it easy
6. **Component Library** - Comprehensive, well-documented

### Trade-offs Accepted:
- Bigger bundle size than pure Tailwind
- More opinionated (less "do whatever")
- Learning curve for new patterns
- Distinctive "Google-y" aesthetic

### Migration Strategy:
- Keep Supabase (database + auth)
- Keep Vercel (hosting)
- Keep Next.js (framework)
- Keep GitHub (version control + Actions)
- **Replace:** Tailwind → Material UI
- **Redesign:** All components with MUI patterns

---

## 📱 Desktop Dashboard Design

### Three-Column Layout

**HEADER (Sticky):**
```
Week 13 | 2 picks available | 0 picks made | 13 picks locked
Your week score: 8 pts | Season total: 87 pts
Active wrinkles: Division Rivalry Bonus (+2 pts)
```

**COLUMN 1: PICKS (35% width)**
1. My Picks This Week (locked picks with live scores)
2. Wrinkle Pick (if active this week)
3. League Picks (locked) - what others picked

**COLUMN 2: DATA (35% width)**
1. Standings (current rankings)
2. Quick Personal Statistics (4 stats, compact)

**COLUMN 3: NFL SCORES (30% width)**
1. This Week's Games (chronological, scrollable)
   - Live updates throughout the day
   - Game status indicators

### Key Features:
- **Independent column scrolling** (minimize scroll on Picks/Data)
- **Read-only dashboard** (picks are made on dedicated Picks page)
- **Call-to-action** when picks available: "You have 2 picks to make" → button to Picks page
- **Live score updates** via existing GitHub Action

### Responsive Breakpoint:
- Collapses to mobile tabs below 1024px-1200px (TBD during implementation)

---

## 📱 Mobile Design

### Navigation Pattern:
**Top Tabs:** Picks | Data | Scores  
**Bottom Nav (optional):** Home | Standings | Stats | Profile

### Mobile UX Principles:
1. **Stacked Content** - Everything scrolls vertically
2. **Larger Touch Targets** - 44px minimum for buttons
3. **Condensed Information** - Only essential details shown
4. **Thumb-Friendly Zone** - Important actions at bottom
5. **Swipeable Tabs** - Natural mobile interaction

### Mobile-Specific Optimizations:
- Compact card designs for thumb-scrolling
- Collapsible sections to reduce scroll
- Action-required banners prominent at top
- Quick stats in smaller 2x2 grid

---

## 🎴 TeamCard Component Evolution

**Current Implementation:** Unified component with multiple states
- Solid (available, locked winning, locked losing)
- Hollow (already used)
- Greyscale (unavailable - game passed)

**Material UI Enhancements:**

### Visual Improvements:
- **Elevation shadows** (1, 2, 3 levels based on state)
- **Hover lift effect** on interactive cards
- **Ripple animation** on click (Material signature)
- **Gradient team logos** (colored circular backgrounds)
- **Colored left border** for status indication
  - Blue = Available
  - Green = Winning
  - Red = Losing
  - Grey = Used/Unavailable

### Information Architecture:
```
[Team Logo (circular, gradient)] [Team Name]
                                  [Game Info: vs/@ Opponent]
                                  
                                  [Status Icon] [Score/Status]
─────────────────────────────────────────────────────────────
[Game Time]                       [Status Badge]
```

### State Variants:

**1. Available to Pick**
- Elevation 2, hover lift
- Blue left border
- "Available" badge
- Add circle icon
- Clickable with ripple

**2. Locked (Winning)**
- Elevation 1
- Green left border
- Check circle icon
- Live score display
- "Winning" indicator with trending up icon

**3. Locked (Losing)**
- Elevation 1
- Red left border
- Cancel icon
- Live score display
- "Losing" indicator with trending down icon

**4. Hollow (Used Team)**
- Dashed border, no elevation
- 60% opacity
- Lock icon
- "Already used" text
- Shows which week it was used

**5. Greyscale (Unavailable)**
- Solid border, no elevation
- 50% opacity
- Grey everything
- "Game passed" indicator

**6. Wrinkle (Special Bonus)**
- Elevation 3
- Purple gradient background
- 2px purple border
- Flag icon
- "+X" bonus points badge
- Extra prominent to stand out

### Dark Mode Considerations:
- Deep grays (not pure black) - easier on eyes
- Stronger elevation shadows for contrast
- Desaturated accent colors (less intense)
- White/gray-300/gray-400 text hierarchy
- AMOLED-friendly for battery savings

**Reference Mockup:** `/outputs/teamcard-mui-comparison.html`

---

## 👤 User Profile & Personalization

### Current Settings:
- Profile color
- Display name
- Password

### V2 Profile Settings:

**1. Display Name**
- Text input, max 50 chars

**2. Profile Color**
- Color picker (existing system)
- Used for personal pick indicators

**3. Password**
- Change password functionality
- Magic link remains primary auth method

**4. Theme Preference** ⭐ NEW
- Light / Dark / Auto (follows system)
- MUI ThemeProvider handles switching
- Stored in user preferences table

**5. Notifications** ⭐ NEW
- On / Off toggle (in-app only, no email)
- Potential notification types:
  - Pick deadline approaching (24 hours)
  - Your picks are live (game day)
  - Weekly standings update
  - Wrinkle opportunities available

**6. Preferred Layout** ⭐ NEW
- Auto-detect and remember last used device
- Options: Auto / Mobile / Desktop
- Stored in browser localStorage or server-side
- Affects which layout renders by default

### EXCLUDED (Considered but decided against):
- ❌ Custom stat preferences (just hardcode 4 best stats)
- ❌ Rival tracker (adds social complexity)
- ❌ Avatar upload (storage concerns)
- ❌ Custom alerts (notification hell)
- ❌ Data export (nice to have, but low demand)
- ❌ Email notifications (in-app only)

### Profile Settings Location:
- Accessible from hamburger menu / profile icon
- Private settings (not visible to other league members)
- Clean, simple form - no feature bloat

---

## 🔧 Admin Dashboard Redesign

### Current State Problems:
1. **Mixed hierarchy** - Global + league-specific tools on same page
2. **Inconsistent UI patterns** - Cards, forms, buttons all different
3. **Unclear workflows** - Lots of scrolling to find features
4. **No visual context** - Hard to know which league you're managing

### Current Admin Functions:
**Global Tools:**
- Team Colors (manage light/dark mode colors)
- Global Schedule (sync from ESPN)
- Invites (manage league invitations)

**League-Specific Tools:**
- Manage League (Members, Invites, Manual Picks)
- Auto-Assign Missed Picks
- Manage Wrinkles
- Team Records Calculator

### V2 Admin Dashboard Structure:

**Layout: Sidebar Navigation (Desktop) / Top Tabs (Mobile)**

#### **1. Dashboard Tab**
League overview and quick actions
```
┌─────────────────────────────────────────┐
│ League Overview Card                     │
│ • 2025 Big Board                         │
│ • 12 members                             │
│ • Week 13 of 18                          │
│ • 3 active wrinkles                      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Quick Actions                            │
│ [Auto-Assign Picks] [Create Wrinkle]    │
│ [Sync Schedule]     [Manual Pick]       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Recent Activity Log                      │
│ • Auto-assigned picks to 3 users (Week 13)
│ • Created wrinkle: Division Rivalry      │
│ • Sarah M. joined the league            │
└─────────────────────────────────────────┘
```

#### **2. Members Tab**
Member management table (MUI DataGrid)
```
┌──────────────────────────────────────────────────────────┐
│ [+ Add Member]  [📧 Send Invites]                        │
├──────────────────────────────────────────────────────────┤
│ Name          | Email          | Role   | Joined | Actions
│ Adam          | adam@...       | Admin  | Aug 24 | [⚙️]   
│ Sarah M.      | sarah@...      | Member | Aug 25 | [⚙️]   
│ Mike T.       | mike@...       | Member | Aug 26 | [⚙️]   
└──────────────────────────────────────────────────────────┘
```

**Member Actions Dropdown:**
- Change role (Admin/Member)
- Create manual pick
- Reset password
- Remove from league

**Invite Management:**
- Generate invite links
- View pending invites
- Revoke invites

#### **3. Wrinkles Tab**
Wrinkle creation and management
```
┌─────────────────────────────────────────┐
│ [+ Create New Wrinkle]                   │
└─────────────────────────────────────────┘

Active Wrinkles - Week 13
┌─────────────────────────────────────────┐
│ 🏴 Division Rivalry Bonus               │
│ Type: Bonus Pick (+2 pts)               │
│ Game: PHI @ DAL                          │
│ [Edit] [Deactivate]                     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 📊 Winless Double                       │
│ Type: 2x Points                          │
│ Eligible: Teams with <0.400 win rate    │
│ [Edit] [Deactivate]                     │
└─────────────────────────────────────────┘

All Season Wrinkles (Upcoming/Past)
[Expandable list...]
```

**Wrinkle Creation Form:**
- Week selector
- Type dropdown (Bonus Pick / ATS / OOF / Winless Double)
- Name input
- Game selector (if applicable)
- Point value
- Preview before creation

#### **4. Tools Tab**
Admin utilities and maintenance
```
┌─────────────────────────────────────────┐
│ 🤖 Auto-Assign Missed Picks              │
│ Season: 2025    Week: [dropdown]        │
│ [Run Auto-Assign]                        │
│ ⚠️ Only runs if all games are FINAL     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 📊 Team Records Calculator               │
│ For Winless Double and OOF wrinkles     │
│ Season: 2025    Week: [dropdown]        │
│ [Refresh Records]                        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 📅 Global Schedule Sync                  │
│ Sync NFL schedule from ESPN             │
│ Last synced: Dec 4, 2024 10:30 AM      │
│ [Sync Now]                               │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 🎨 Team Colors                           │
│ Manage light/dark mode colors           │
│ [Open Color Manager]                     │
└─────────────────────────────────────────┘
```

#### **5. Settings Tab**
League configuration
```
┌─────────────────────────────────────────┐
│ League Settings                          │
│                                          │
│ League Name: [2025 Big Board]           │
│ Season Year: [2025]                     │
│                                          │
│ Game Rules                               │
│ • Total picks per season: 32            │
│ • Base picks per week: 2                │
│ • Playoff format: Snake draft (Top 4)   │
│                                          │
│ [Save Changes]                           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Danger Zone                              │
│ [Delete League] ← Requires confirmation │
└─────────────────────────────────────────┘
```

### Admin UX Improvements:

**1. Context Awareness**
- Selected league always visible in header/sidebar
- Breadcrumb navigation (Admin > 2025 Big Board > Members)
- Can't accidentally perform actions on wrong league

**2. Consistent Patterns**
- All admin actions use Material UI components
- Confirmation dialogs for destructive actions
- Success/error notifications (Snackbar)
- Loading states for async operations

**3. Clear Workflows**
- Each function has dedicated space
- No more endless scrolling
- Related actions grouped logically

**4. Better Feedback**
- Activity log shows recent admin actions
- Audit trail for accountability
- Clear success/error messages

**Reference:** See uploaded screenshots in conversation for current admin interface

---

## 🗄️ Database Redesign Strategy

### Current Pain Points:
- `league_members` vs `league_memberships` confusion
- Scattered table purposes
- Legacy structures from iterative development

### V2 Approach:

**Principles:**
1. **Every table has ONE clear purpose**
2. **No confusing overlaps**
3. **Intentional relationships**
4. **Clean naming conventions**

### Proposed Consolidation:
```
BEFORE:
- league_members (????)
- league_memberships (????)

AFTER:
- league_members
  - id
  - league_id (FK)
  - user_id (FK)
  - role (admin/member)
  - joined_at
  - color_preference
```

### Database Review Checklist:
- [ ] Audit all existing tables
- [ ] Document current purpose of each table
- [ ] Identify redundancies
- [ ] Map relationships clearly
- [ ] Design new schema from scratch
- [ ] Plan migration strategy for historical data
- [ ] Test with sample data before production migration

**Note:** Full database redesign to be done during epic planning phase (Day 1-2 after Week 18)

---

## ⚡ Performance Optimization

### Known Issues to Investigate:
- Page load times *feel* snappy, but may be inefficient
- Unknown query counts per page
- Potential unnecessary re-renders
- Image optimization status unknown

### V2 Performance Audit Plan:

**1. Network Analysis**
- Capture HAR file of app usage
- Analyze:
  - API call counts (redundant fetches?)
  - Query performance (slow queries?)
  - Unused data (fetching 100 fields, using 5?)
  - Waterfall issues (sequential when could be parallel?)
  - Bundle sizes (shipping too much JS?)

**2. Database Query Optimization**
- Count queries per page load
- Identify N+1 query problems
- Add indexes where needed
- Implement query caching where appropriate

**3. React Performance**
- Component re-render analysis
- Memoization opportunities
- Code splitting (lazy loading)
- Virtual scrolling for long lists

**4. Asset Optimization**
- Image compression
- Team logo sprite sheets
- Font loading strategy
- CSS bundle size

**When:** Early in v2 development, before building too much. Establish performance baselines.

---

## 🔐 Authentication Strategy

### Current System (Working Well):
- **Primary:** Magic links (passwordless)
- **Fallback:** Password authentication
- **Why:** Parental controls on kids' iPads block magic links
- Dual system ensures 100% access

### V2 Changes:

**Option 1: Keep Current System (Recommended)**
- Magic links remain primary
- Password remains available
- Well-tested, handles edge cases

**Option 2: Auth Wall at Front Door**
- **NEW:** No public homepage
- Auth required to see ANYTHING
- Forces login before accessing any content
- Cleaner from security perspective
- Better analytics (know who's visiting)

**Decision:** Implement Option 2 (auth wall) in V2
- More secure
- Cleaner user flow
- No "guest" state to manage
- All users are authenticated users

### V2 Auth Flow:
```
User visits thebigboard.app
  ↓
Auth Wall (login page)
  ↓
Choose: Magic Link or Password
  ↓
Authenticated → Dashboard
```

---

## 🎯 V2 Development Timeline

### Phase 1: Planning (Week 18 + 1-2 days)
**After season ends, before dev starts**

- [x] Review this document
- [ ] Capture network trace (HAR file)
- [ ] Performance audit and analysis
- [ ] Database schema redesign
- [ ] Build epic list (features to implement)
- [ ] Prioritize features (must-have vs nice-to-have)
- [ ] Design system decisions (MUI theme, colors, spacing)

**Deliverables:**
- Performance baseline metrics
- New database schema with migration plan
- Epic list with time estimates
- MUI design system (theme config)

### Phase 2: Foundation (January - February)
**8 weeks**

- [ ] Set up clean Next.js + MUI + Supabase project
- [ ] Implement new database schema
- [ ] Migrate historical data (test thoroughly!)
- [ ] Build authentication system (auth wall)
- [ ] Create base layouts (desktop 3-col, mobile tabs)
- [ ] Implement theme system (light/dark/auto)
- [ ] Build new TeamCard component with MUI

**Milestone:** Basic app structure running with new database

### Phase 3: Core Features (March - April)
**8 weeks**

- [ ] Dashboard (read-only view)
- [ ] Picks page (make selections)
- [ ] Standings page
- [ ] Stats/analytics views
- [ ] User profile & settings
- [ ] Wrinkle system
- [ ] Live score updates (GitHub Actions integration)

**Milestone:** All user-facing features working

### Phase 4: Admin & Polish (May - June)
**8 weeks**

- [ ] New admin dashboard (sidebar nav)
- [ ] Member management
- [ ] Wrinkle management
- [ ] Admin tools (auto-assign, schedule sync, etc.)
- [ ] Activity logging
- [ ] Performance optimization pass
- [ ] Mobile responsive refinement
- [ ] Accessibility audit

**Milestone:** Admin tools complete, app feels polished

### Phase 5: Testing & Launch Prep (July - August)
**8 weeks**

- [ ] End-to-end testing
- [ ] Load testing (simulate full league usage)
- [ ] Bug fixes
- [ ] Documentation (user guide, admin guide)
- [ ] Data migration dry run (production data)
- [ ] Beta testing with league members?
- [ ] Final performance audit
- [ ] Pre-season marketing/announcement

**Milestone:** Production-ready for Week 1

### Phase 6: Launch (Early September)
- [ ] Final production deployment
- [ ] Monitor closely for issues
- [ ] Quick bug fixes if needed
- [ ] Enjoy the season! 🎉

**Timeline Total:** ~32 weeks (8 months)  
**Buffer Time:** Built into each phase for unexpected issues

---

## 📦 Technology Stack

### Keeping (Proven):
- **Next.js** - React framework
- **Supabase** - Database + Auth
- **Vercel** - Hosting + Deployment
- **GitHub** - Version control
- **GitHub Actions** - Automated tasks (score updates, pick assignments)

### Replacing:
- **Tailwind CSS** → **Material UI (MUI)**

### New Additions:
- **MUI Icons** - Material Icons throughout
- **MUI Data Grid** (potentially) - For admin tables

### Development Tools:
- **TypeScript** - Type safety (already using)
- **ESLint** - Code quality
- **Prettier** - Code formatting
- **React DevTools** - Debugging
- **Chrome DevTools** - Performance profiling

---

## 🎨 Design System Specifications

### Material UI Theme Configuration

**Primary Color Palette:**
```javascript
primary: {
  main: '#1976d2',    // Blue
  light: '#42a5f5',
  dark: '#1565c0',
}

secondary: {
  main: '#9c27b0',    // Purple (for wrinkles)
  light: '#ba68c8',
  dark: '#7b1fa2',
}

success: {
  main: '#2e7d32',    // Green (winning picks)
}

error: {
  main: '#d32f2f',    // Red (losing picks)
}

warning: {
  main: '#ed6c02',    // Orange (deadline warnings)
}
```

**Typography:**
```javascript
fontFamily: 'Roboto, sans-serif',

h1: { fontSize: '2.5rem', fontWeight: 500 },
h2: { fontSize: '2rem', fontWeight: 500 },
h3: { fontSize: '1.75rem', fontWeight: 500 },
body1: { fontSize: '1rem' },
body2: { fontSize: '0.875rem' },
```

**Spacing Scale:**
```javascript
// MUI uses 8px base unit
spacing: 8,

// Common spacing values:
// 1 = 8px
// 2 = 16px
// 3 = 24px
// 4 = 32px
// 6 = 48px
```

**Elevation Levels:**
- 0 = Flat (disabled states)
- 1 = Resting cards
- 2 = Raised cards (hover state)
- 3 = Special emphasis (wrinkles)
- 4 = App bar / fixed elements

**Border Radius:**
```javascript
borderRadius: 8,  // Rounded corners throughout
```

### Dark Mode Colors:
```javascript
dark: {
  background: {
    default: '#121212',
    paper: '#1e1e1e',
  },
  
  text: {
    primary: '#ffffff',
    secondary: 'rgba(255, 255, 255, 0.7)',
  },
}
```

**Design Tokens Document:** To be created in Phase 1 (Figma or code config file)

---

## 📚 Key Learnings from V1

### What Worked:
1. **Unified component systems** (TeamCard everywhere)
2. **Centralized Supabase client** (security + consistency)
3. **Dual authentication** (handles edge cases)
4. **GitHub Actions for automation** (hands-off operation)
5. **Profile color personalization** (users love it)
6. **Mobile-first approach** (matches actual usage)

### What Didn't Work:
1. **Making changes during live season** (caused regressions)
2. **Scope creep during implementation** (stay focused)
3. **Scattered admin utilities** (hard to find, hard to use)
4. **Long mobile pages** (too much scrolling)
5. **Desktop as "mobile but wider"** (wasted potential)

### Development Principles for V2:
1. ✅ **Make one change at a time**
2. ✅ **Test each change before proceeding**
3. ✅ **Avoid scope creep** (stick to epic plan)
4. ✅ **Mobile-first, desktop-enhanced** (not mobile-only)
5. ✅ **Unified component systems** (don't scatter implementations)
6. ✅ **Comprehensive testing before launch** (no live-season fixes)
7. ✅ **Document as you go** (future you will thank you)

---

## 🚀 Feature Parity Checklist

### Must-Have (100% Parity):
- [ ] Make picks (32 teams, weekly quotas)
- [ ] View standings (league rankings)
- [ ] View stats (personal + league)
- [ ] Wrinkle system (all 4 types)
- [ ] Live score updates
- [ ] Playoff system (snake draft for top 4)
- [ ] Dual authentication
- [ ] Profile customization (color, name)
- [ ] Admin: Member management
- [ ] Admin: Wrinkle management
- [ ] Admin: Auto-assign picks
- [ ] Admin: Manual pick creation
- [ ] Theme support (existing dark mode)

### New Features (10% Exploration):
- [ ] Auth wall (no public homepage)
- [ ] Desktop 3-column dashboard
- [ ] Mobile tab navigation
- [ ] Theme preference (light/dark/auto)
- [ ] In-app notifications (on/off toggle)
- [ ] Last-used device preference
- [ ] Unified admin dashboard (sidebar nav)
- [ ] Activity log (audit trail)
- [ ] Better performance (faster loads)
- [ ] Improved mobile UX (less scrolling)

### Explicitly Excluded:
- ❌ Email notifications
- ❌ Rival tracker
- ❌ Avatar upload
- ❌ Custom stat preferences
- ❌ Data export
- ❌ Custom alert rules

---

## 🎬 Getting Started (When Ready)

### Pre-Development Checklist:
1. [ ] Read this entire document
2. [ ] Review all mockup files in `/outputs/`
3. [ ] Capture network trace (HAR file)
4. [ ] Review current database schema
5. [ ] Clone current repo to preserve V1
6. [ ] Create new V2 repo (or branch?)
7. [ ] Set up clean Next.js + MUI project
8. [ ] Set up Supabase project (or migrate existing?)

### Key Questions to Answer Before Starting:
- [ ] New Supabase project or migrate existing?
- [ ] New repo or branch off existing?
- [ ] How to handle historical data migration?
- [ ] Beta test with league members or launch cold?
- [ ] Gradual rollout or full switch?

### First Week Goals:
1. Set up development environment
2. Create MUI theme configuration
3. Build one complete page as proof of concept (dashboard?)
4. Ensure it's fast on mobile
5. Get team buy-in on visual direction

---

## 📁 Reference Files

All design mockups created during planning session:

### Desktop Mockups:
- `dashboard-mockup.html` - Original 3-column concept
- `tailwind-dashboard.html` - Pure Tailwind version
- `shadcn-dashboard.html` - shadcn/ui version
- `mui-dashboard.html` - Material UI version (SELECTED)
- `mui-dark-desktop.html` - Material UI dark mode

### Mobile Mockups:
- `mui-mobile-light.html` - Material UI mobile light mode
- `mui-mobile-dark.html` - Material UI mobile dark mode

### Component Mockups:
- `teamcard-mui-comparison.html` - TeamCard evolution (light + dark)

### Admin Screenshots:
- `admin-current-1.png` - Current admin page (top section)
- `admin-current-2.png` - Current admin page (league management)

**Location:** All files in `/mnt/user-data/outputs/`

---

## 💭 Open Questions for V2

**Questions to resolve during epic planning:**

1. **Database Migration:**
   - Keep existing Supabase project or create new?
   - How to migrate historical data without downtime?
   - Test migration strategy?

2. **Deployment Strategy:**
   - Parallel deployment (V1 + V2 running simultaneously)?
   - Hard cutover after Week 18?
   - Beta period with select users?

3. **Mobile Navigation:**
   - Top tabs only?
   - Bottom nav bar?
   - Hybrid approach?

4. **Notifications:**
   - What triggers in-app notifications?
   - Toast messages? Persistent badge?
   - How granular should on/off toggle be?

5. **Admin Access:**
   - Separate admin subdomain (admin.thebigboard.app)?
   - Or same app with role-based routing?
   - How to prevent accidental league switches?

6. **Backward Compatibility:**
   - Support old URLs/bookmarks?
   - Redirect old routes to new?
   - Or clean break?

7. **Testing:**
   - Automated testing strategy?
   - E2E tests for critical paths?
   - Load testing tools?

---

## 🎉 Success Criteria

**V2 Launch is successful if:**

✅ Zero critical bugs in first 3 weeks  
✅ Mobile load time <2 seconds  
✅ Desktop load time <1.5 seconds  
✅ Zero admin interventions needed during regular season  
✅ No authentication issues reported  
✅ Positive user feedback on new design  
✅ Adam can "sit back and enjoy the season"  

**Metrics to Track:**
- Page load times (Lighthouse scores)
- Error rates (Vercel analytics)
- User engagement (time on site, pages per session)
- Mobile vs desktop usage split
- Feature adoption (dark mode usage, notification preferences)

---

## 📞 Contact & Resources

**Developer:** Adam  
**Project Name:** The Big Board  
**Current Production URL:** TBD  
**V2 Development URL:** TBD  

**Key External Resources:**
- Material UI Docs: https://mui.com
- Next.js Docs: https://nextjs.org/docs
- Supabase Docs: https://supabase.com/docs
- Vercel Docs: https://vercel.com/docs

**Project Repository:** TBD (to be created)

---

## 🔄 Document Version History

**v1.0 - December 4, 2024**
- Initial document creation
- Captured design decisions from planning session
- Created all reference mockups
- Defined V2 vision and scope

**Next Review:** After Week 18 (Early January 2025)

---

## 📝 Notes for Future Adam

Hey, it's December 4th Adam here. You're probably reading this in early January after Week 18 wraps up. Here's what you need to know:

**What We Did Today:**
We spent a few hours dreaming up what V2 could be. You got really excited about Material UI and wanted to jump in immediately, but we stayed disciplined and waited. That was the right call.

**What You Should Do First:**
1. Open all those mockup files in `/outputs/` - they're beautiful and will get you excited again
2. Read this document top to bottom
3. Capture that HAR file to see what's actually happening with network calls
4. Take 1-2 days to plan epics before writing any code

**What You're Excited About:**
- Material UI's polished look
- The 3-column desktop dashboard
- The unified admin experience
- Dark mode done right
- Making something you're proud to show people

**What You're Nervous About:**
- 8 months is a long time
- What if you lose momentum?
- What if Material UI doesn't live up to the hype?
- What if the migration breaks something?

**Advice from Past You:**
- Trust the process. You planned this carefully.
- Don't skip the foundation work - it pays off later.
- Make one thing great before moving to the next.
- Test obsessively - you don't want Week 1 disasters.
- Remember: "Rock solid on day one" is the goal.

**You've Got This.** The vision is clear. The mockups are gorgeous. The plan is solid. Just execute.

Now go build something amazing. 🚀

---

**END OF DOCUMENT**

*This document is a living guide. Update it as decisions are made and the project evolves.*
