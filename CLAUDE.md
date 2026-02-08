# Claude Context for WeChat Tennis

## Rules

After significant changes to the codebase that invalidate the information in this file, you must update this file so that it stays up-to-date.

## Project Overview

WeChat Mini Program for managing a tennis community/league. Features: player profiles with NTRP ratings, event creation, automated matchmaking by NTRP, match result entry with set-by-set scoring, statistics tracking, and season-based competitions. Supports English and Mandarin.

**Stack:** WeChat Mini Program (WXML/WXSS/JS) + WeChat CloudBase (serverless Node.js functions + NoSQL database)

## Project Structure

```
miniprogram/           # Client-side WeChat Mini Program
  app.js               # Entry point, CloudBase init
  config.js            # Environment config (gitignored, copy from config.example.js)
  config.example.js    # Template for config.js
  pages/               # 9 pages: index, event, profile, matches, stats, admin, season, players, settings
  components/          # Reusable components (searchable-picker)
  utils/
    cloud.js           # Cloud function wrapper (routes to local in devMode)
    i18n.js            # Internationalization (English + Mandarin)
    local-store.js     # In-memory DB for local development
    local-handlers.js  # Mock cloud functions for devMode

docs/                  # Documentation
  DATABASE_GUIDE.md    # Database操作指南 (Mandarin)

cloudfunctions/        # 24 serverless functions (Node.js)
  # Player: upsertPlayer, getPlayer, listPlayers
  # Events: createEvent, listEvents, updateEvent, completeEvent, reopenEvent
  # Signups: signupEvent, listSignups
  # Matchmaking: generateMatchups, regenerateMatchups, approveMatchups
  # Results: enterResult, listMatches
  # Stats: getStats, recalculateStats, getSeasonStats
  # Seasons: createSeason, listSeasons, setActiveSeason, adminAdjustSeasonPoints
  # Data: adminExportCSV, adminImportCSV
```

## Database Collections

- `players` - Player profiles (name, gender, NTRP, wechatOpenId)
- `events` - Tennis events (date, location, startTime, endTime, matchTypesAllowed, seasonId, status, playerPoints, completedAt)
- `signups` - Event signups (playerId, eventId, preferredMatchTypes, seasonId)
- `matches` - Generated matches (teamsA/B, matchType, status, seasonId)
- `results` - Match results (matchId, score, sets, winner, winnerPlayers)
- `stats` - Overall player stats (wins, losses, points, attendance)
- `settings` - App config; single doc at `settings/core` with adminOpenIds, activeSeasonId
- `seasons` - Season definitions (name, dates, status)
- `season_point_adjustments` - Point adjustment ledger for manual adjustments

## Match Types

Fixed enum of 5 match types (stored as strings):
- `mens_singles` - Male players only, 1v1
- `womens_singles` - Female players only, 1v1
- `mens_doubles` - Male players only, 2v2
- `womens_doubles` - Female players only, 2v2
- `mixed_doubles` - Male+Female teams, 2v2

## Event Status Flow

Events progress through these statuses:
- `open` - Initial state, players can sign up
- `matchups_draft` - Matchups generated, awaiting admin review
- `matchups_approved` - Matchups approved, results can be entered
- `completed` - Event finalized, `playerPoints` calculated and stored

Admin can reopen a completed event to make corrections, then complete it again.

## Season Status

Seasons have a `status` field with these values:
- `active` - Season is ongoing, matches can be played and recorded
- `closed` - Season has ended, historical data preserved for viewing

When setting a new active season with `closePrevious: true`, the previous season's status changes to `closed`.

## Key Patterns

### Cloud Functions
Every function follows this structure:
1. Init cloud SDK with dynamic env
2. Extract OPENID from `cloud.getWXContext()`
3. Check admin permissions if needed (via `settings.adminOpenIds`)
4. Execute DB operations
5. Return `{ success: true, ... }` or throw Error

### Authentication
- WeChat provides OPENID automatically in cloud context
- Player profile linked via `players.wechatOpenId`
- First user to call admin function becomes admin (bootstrap logic)

### Matchmaking Algorithm
Filters players by gender per match type, then pairs by NTRP:
- **mens_singles/womens_singles**: Filter by gender, pair adjacent players by NTRP
- **mens_doubles/womens_doubles**: Filter by gender, pair into teams, then pair teams by combined NTRP
- **mixed_doubles**: Pair male/female into teams, then pair teams by combined NTRP
- Unmatched players go to waitlist

### Stats Calculation
- Overall: `points = wins * winPoints + losses * lossPoints` (recalculated on every result entry)
- Season: Points are event-based (1 point per win). When admin completes an event, `playerPoints` map is stored on the event. Season leaderboard aggregates `playerPoints` from all completed events + manual adjustments.

## Important Gotchas

1. **No shared modules** - Helper functions (settings fetch, admin check) are duplicated across cloud functions. If you add a new one, copy the pattern.

2. **Settings bootstrap** - `settings/core` document is auto-created with defaults on first access. Check `getSettings()` helper in any cloud function.

3. **Season inheritance** - Events created without `seasonId` inherit the active season from settings.

4. **DB IDs are redundant** - Documents store both `_id` and a separate `{entityType}Id` field (e.g., `playerId`). Maintain both when creating records.

5. **NTRP is a number** - Stored as float (e.g., 3.5, 4.0). Used for sorting in matchmaking.

6. **Error messages are uppercase codes** - e.g., `throw new Error('NOT_ADMIN')`, `throw new Error('EVENT_NOT_FOUND')`

## Development Workflow

### Configuration
1. Copy `miniprogram/config.example.js` to `miniprogram/config.js`
2. Edit `config.js` with your settings (this file is gitignored)

### Local Development Mode
Set `devMode: true` in `config.js` to run without CloudBase:
- All cloud functions are mocked in `local-handlers.js`
- Data stored in-memory via `local-store.js`
- Mock user `DEV_USER_001` is auto-granted admin access
- Pre-seeded with test players and one event

### Production Mode
1. Set `devMode: false` in `config.js`
2. Set `envId` to your CloudBase environment ID
3. Deploy cloud functions: right-click folder > "Upload and Deploy"
4. Test: Run Mini Program in simulator or preview on device

## Files You'll Edit Most Often

- `miniprogram/pages/admin/admin.js` - All admin functionality
- `cloudfunctions/*/index.js` - Each function is self-contained
- `miniprogram/utils/i18n.js` - Add/edit translations
- `miniprogram/app.json` - Page routes, window config

## Internationalization

The app supports English (en) and Mandarin (zh):
- Language auto-detected from device settings
- User can switch language on settings page
- All strings in `utils/i18n.js`
- Pages load strings via `i18n.getStrings()` into `data.i18n`

## Current Status

Core features complete including:
- Local development mode with in-memory storage
- Gender-based matchmaking (5 match types)
- Event signup display with player names
- Redesigned admin result entry with set-by-set scoring and ad-hoc matches
- i18n support (English + Mandarin)
- Season management with tap-to-view match results
- listMatches supports filtering by seasonId
- Event-based points system (1 point per win, calculated when event is completed)
- Season leaderboard shows aggregated points from completed events

No automated tests exist - testing is manual via DevTools or local mode.
