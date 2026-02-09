# WeChat Tennis Community Mini App (CloudBase)

This is a vibe coded WeChat Mini Program and CloudBase backend for administering a tennis community. It allows users to signup for events and admins to create and manage events and seasons.

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

## Test flow
1. Create a new season and activate it
2. Create a new event
3. Sign up for the new event
4. Sign up test players for the new event
5. Generate matchups
6. Add manual matchups

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

## Local Development Mode

You can run the app without CloudBase for local testing:

1. Copy `miniprogram/config.example.js` to `miniprogram/config.js`
2. Set `devMode: true` in `config.js`
3. Run the app in WeChat DevTools

In dev mode:
- All data is stored in-memory (resets on refresh)
- Mock user `DEV_USER_001` is auto-granted admin access
- Pre-seeded with test players and one event
- No CloudBase deployment needed

## Deployment

### Deploy Cloud Functions

1. In WeChat DevTools, right-click each folder in `cloudfunctions/`
2. Select **Upload and Deploy: Cloud Install Dependencies**
3. Wait for each function to deploy successfully
4. Verify in the CloudBase console that all functions are listed

### Set Up Experience Version (for Testers)

The experience version lets non-technical testers use the app without publishing it publicly.

1. **Upload your code**:
   - In WeChat DevTools, click the **Upload** button (上传) in the toolbar
   - Enter a version number (e.g., `0.1.0`) and description
   - Click **Upload**

2. **Set as experience version**:
   - Log in to [WeChat MP Admin Console](https://mp.weixin.qq.com)
   - Go to **管理 → 版本管理 → 开发版本**
   - Find your uploaded version and click **设为体验版**

3. **Add experience members**:
   - Go to **管理 → 成员管理 → 体验成员**
   - Click **添加成员**
   - Enter the tester's WeChat ID (微信号, not nickname)
   - They will receive a notification to accept the invitation

4. **Share the QR code**:
   - In 版本管理, click on the experience version to see its QR code
   - Send this QR code to your testers
   - They scan it with WeChat to open the app

**Notes:**
- Testers must be added as experience members before they can access the app
- Experience version persists until you upload a new one
- You can have up to 100 experience members
- Cloud functions must be deployed for the app to work

### Publish to Production

1. **Submit for review**:
   - In [WeChat MP Admin Console](https://mp.weixin.qq.com), go to **版本管理**
   - Find your development version and click **提交审核**
   - Fill in the required information (category, description, screenshots)
   - Submit and wait for review (typically 1-3 business days)

2. **Release after approval**:
   - Once approved, the version appears in **审核版本**
   - Click **发布** to make it publicly available
   - Users can find the app by searching its name in WeChat

## Next steps you might want
- Player-submitted results with admin approval.
- Admin UI for editing matchups directly.
- Notifications to players on signup/match publish.
- Skill updates and rating history.

## Cloudbase querying
It's easier to query in in the DevTools console than in the UI. An example query:
```
  const db = wx.cloud.database()                                                                                  
  db.collection('matches').where({                                                                                
    participants: "<your id>"                                                              
  }).get().then(res => console.log(res.data))                                                                     
  ```