# WeChat Tennis Community Mini App (CloudBase)

This is a starter implementation of the WeChat Mini Program and CloudBase backend described in your plan.

## Whats included
- Mini Program pages: events list, event signup, profile, matches, stats, admin dashboard.
- Cloud Functions: event CRUD, signups, matchmaking, approval/regeneration, results, stats, seasons, CSV import/export, player profile helpers.
- Collections: `players`, `events`, `signups`, `matches`, `results`, `stats`, `settings`, `seasons`, `season_stats`, `season_point_adjustments`.

## Prereqs
1. A WeChat Mini Program account (AppID).
2. WeChat DevTools installed.
3. Cloud Development enabled for your Mini Program.

## Setup (WeChat DevTools)
1. Open WeChat DevTools and import this project folder.
2. Update `project.config.json` with your AppID.
3. Enable Cloud Development in DevTools and create a CloudBase environment.
4. Update `miniprogram/app.js` with your CloudBase environment ID.
5. Create the database collections:
   - `players`, `events`, `signups`, `matches`, `results`, `stats`, `settings`
   - `seasons`, `season_stats`, `season_point_adjustments`
6. Deploy cloud functions (each subfolder in `cloudfunctions/`).
7. Create database indexes (recommended):
   - `players`: `wechatOpenId`
   - `signups`: `eventId`, `playerId`
   - `matches`: `eventId`, `participants`, `status`
   - `results`: `matchId`
   - `stats`: `_id`
   - `events`: `seasonId`
   - `signups`: `seasonId`
   - `matches`: `seasonId`
   - `results`: `seasonId`
   - `seasons`: `startDate`
   - `season_stats`: `seasonId`, `playerId`
   - `season_point_adjustments`: `seasonId`, `playerId`

## Quick Start Checklist
- [ ] Import project in WeChat DevTools
- [ ] Set AppID in `project.config.json`
- [ ] Create CloudBase environment and set envId in `miniprogram/app.js`
- [ ] Create collections: `players`, `events`, `signups`, `matches`, `results`, `stats`, `settings`, `seasons`, `season_stats`, `season_point_adjustments`
- [ ] Deploy all cloud functions in `cloudfunctions/`
- [ ] Create recommended indexes
- [ ] Run the app, save your profile, and create a test event

## Admin bootstrap
The first user to call any admin function becomes admin and is saved in `settings/core.adminOpenIds`.
You can add more admins by editing the `settings` collection.

## Matchmaking notes
- Uses NTRP to sort within each skill band.
- Singles: closest pairs by NTRP.
- Doubles: pair adjacent players into teams, then pair teams by total NTRP.
- Mixed: pair male/female by NTRP, then pair teams by total NTRP.
- Remaining players are placed into the event waitlist per time slot.

## CSV import/export
- Export returns a CSV string from a collection.
- Import expects a header row. Basic types are coerced (numbers/booleans/JSON strings).
- Arrays/objects should be JSON strings in the CSV.

## Seasons
- Admins can create seasons and set one active at a time.
- Events without a `seasonId` will inherit the active season when created.
- Season stats are tracked in `season_stats` and include point adjustments from `season_point_adjustments`.
- Season points are computed as `wins * winPoints + losses * lossPoints + sum(adjustments)`.

## Testing the app (manual)
1. In DevTools, run the Mini Program and open the home page.
2. Go to **My Profile** and save your name, gender, and NTRP.
3. Open **Admin** and create an event (date, location, slots, match types, skill bands).
4. Go back to **Events**, open the event, and sign up with availability.
5. Return to **Admin** and click **Generate Matchups**, then **Approve Matchups**.
6. Check **My Matches** to see the published matchups.
7. In **Admin**, enter a result for a match (Match ID + score + winner).
8. Check **My Stats** to confirm wins/losses/points update.
9. (Optional) Use **CSV Export** to pull data and **CSV Import** to rehydrate.

## Next steps you might want
- Player-submitted results with admin approval.
- Admin UI for editing matchups directly.
- Notifications to players on signup/match publish.
- Skill updates and rating history.
