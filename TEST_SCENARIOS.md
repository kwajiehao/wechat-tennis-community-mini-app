# WeChat Tennis - Test Scenarios

This document covers all user flows and features for manual testing. Test in local dev mode (`devMode: true`) or against CloudBase.

---

## Pre-Seeded Test Data (Local Dev Mode)

| Player | Gender | NTRP | OpenID | Role |
|--------|--------|------|--------|------|
| Dev Admin | M | 4.0 | DEV_USER_001 | Admin |
| Alice Test | F | 3.5 | DEV_USER_002 | Regular |
| Bob Test | M | 3.5 | DEV_USER_003 | Regular |
| Carol Test | F | 4.0 | DEV_USER_004 | Regular |

**Pre-seeded Event:** "Dev Tennis Event" (2026-02-15, open status, allows mens_singles, womens_singles, mixed_doubles)

**Pre-seeded Season:** "Dev Season" (2026-01-01 to 2026-06-30, active)

---

## 1. Player Registration & Profile

### 1.1 New User Registration
**Steps:**
1. Open app as new user (no profile)
2. Navigate to Profile page
3. Enter name, select gender, select NTRP rating
4. Tap Save

**Expected:**
- Profile saved successfully
- Index page shows "Profile" button (not "Register")
- Player appears in Players list

### 1.2 Profile Update
**Steps:**
1. Navigate to Profile page (existing user)
2. Change NTRP rating
3. Tap Save

**Expected:**
- Profile updated
- New NTRP reflected in Players list and matchmaking

### 1.3 Incomplete Profile Validation
**Steps:**
1. Try to save profile with missing name/gender/NTRP

**Expected:**
- Error message shown
- Profile not saved

---

## 2. Event Signup Flow

### 2.1 View Event Details
**Steps:**
1. From Index, tap an event
2. View event details page

**Expected:**
- Shows title, date, location, times
- Shows allowed match types
- Shows signed-up players with NTRP ratings

### 2.2 Sign Up for Event
**Steps:**
1. Open event detail page
2. Select preferred match types (optional)
3. Tap "Sign Up"

**Expected:**
- Success confirmation
- Button changes to "Withdraw"
- Player appears in signed-up list

### 2.3 Sign Up Without Profile
**Steps:**
1. As new user (no profile), try to sign up for event

**Expected:**
- Error: "PROFILE_INCOMPLETE"
- Prompt to complete profile first

### 2.4 Withdraw from Event
**Steps:**
1. As signed-up player, tap "Withdraw"

**Expected:**
- Confirmation
- Button changes back to "Sign Up"
- Player removed from signed-up list

---

## 3. Matchmaking (Admin)

### 3.1 Generate Matchups
**Precondition:** Event has signed-up players

**Steps:**
1. Admin page → Events section
2. Select event with signups
3. Tap "Generate Matchups"

**Expected:**
- Matchups created based on gender/match type
- Event status changes to "matchups_draft"
- Can view matchups in modal

### 3.2 Matchmaking Algorithm - Men's Singles
**Setup:** 2+ male players signed up for mens_singles

**Expected:**
- Players sorted by NTRP
- Adjacent players paired (closest NTRP)
- Odd player goes to waitlist

### 3.3 Matchmaking Algorithm - Women's Singles
**Setup:** 2+ female players signed up for womens_singles

**Expected:**
- Same as men's singles, filtered by female gender

### 3.4 Matchmaking Algorithm - Men's Doubles
**Setup:** 4+ male players signed up for mens_doubles

**Expected:**
- Players sorted by NTRP
- Paired into teams of 2 (consecutive players)
- Teams sorted by combined NTRP
- Adjacent teams matched
- Leftover team/players go to waitlist

### 3.5 Matchmaking Algorithm - Women's Doubles
**Setup:** 4+ female players signed up for womens_doubles

**Expected:**
- Same as men's doubles, filtered by female gender

### 3.6 Matchmaking Algorithm - Mixed Doubles
**Setup:** 2+ male and 2+ female players signed up for mixed_doubles

**Expected:**
- Male+female paired into teams
- Teams sorted by combined NTRP
- Adjacent teams matched
- Unmatched players go to waitlist

### 3.7 View Matchups Modal
**Steps:**
1. After generating matchups, tap "View Matchups"

**Expected:**
- Modal shows all generated matches
- Shows team compositions with player names
- Shows waitlist if applicable

### 3.8 Approve Matchups
**Steps:**
1. View generated matchups
2. Tap "Approve"

**Expected:**
- Matches status changes to "approved"
- Event status changes to "matchups_approved"
- Matches visible to all users

### 3.9 Regenerate Matchups
**Steps:**
1. After approval, tap "Regenerate"

**Expected:**
- All existing matches deleted
- New matchups generated
- Status reverts to "matchups_draft"

---

## 4. Result Entry (Admin)

### 4.1 Enter Result - Matchmaking Mode
**Precondition:** Event has approved matches

**Steps:**
1. Admin page → Result Entry section
2. Select "Matchmaking Mode"
3. Select event
4. Select match from dropdown
5. Enter set scores (e.g., 6-4, 7-5)
6. Select winner (Team A or Team B)
7. Submit

**Expected:**
- Result recorded
- Match status changes to "completed"
- Stats updated for all players

### 4.2 Enter Result - Ad-Hoc Mode
**Steps:**
1. Admin page → Result Entry section
2. Select "Ad-Hoc Mode"
3. Select match type
4. Select Team A players (using searchable picker)
5. Select Team B players
6. Enter set scores
7. Select winner
8. Submit

**Expected:**
- New match created
- Result recorded immediately
- Stats updated

### 4.3 Set-by-Set Scoring
**Steps:**
1. Add multiple sets (2-3)
2. Enter games for each team per set

**Expected:**
- Score formatted as "6-4 7-5 6-3"
- All sets recorded in result

### 4.4 Singles Match Result
**Setup:** Singles match (1v1)

**Expected:**
- Team A: 1 player
- Team B: 1 player
- Winner gets 1 win, loser gets 1 loss

### 4.5 Doubles Match Result
**Setup:** Doubles match (2v2)

**Expected:**
- Team A: 2 players
- Team B: 2 players
- All winning team members get wins
- All losing team members get losses

---

## 5. Event Completion Flow (Admin)

### 5.1 Complete Event
**Precondition:** Event in "matchups_approved" status, has completed matches

**Steps:**
1. Admin page → Events section
2. Tap "Complete Event"

**Expected:**
- Event status changes to "completed"
- `playerPoints` calculated (1 point per win)
- Points reflected in season leaderboard

### 5.2 Complete Event Without Matches
**Steps:**
1. Try to complete event with no completed matches

**Expected:**
- Event completes with empty playerPoints
- No points awarded

### 5.3 Reopen Completed Event
**Steps:**
1. On completed event, tap "Reopen"

**Expected:**
- Event status reverts to "matchups_approved"
- playerPoints cleared
- Can re-enter/modify results

---

## 6. Statistics

### 6.1 View Overall Stats
**Steps:**
1. Navigate to Stats page

**Expected:**
- Shows wins, losses, points, win rate
- Aggregated across all matches

### 6.2 View Season Stats
**Steps:**
1. Navigate to Stats page

**Expected:**
- Shows current season stats
- Points from completed events + adjustments

### 6.3 Stats Calculation
**Formula:**
- `points = wins * winPoints + losses * lossPoints`
- Default: winPoints=3, lossPoints=1
- `winRate = wins / (wins + losses)`
- `attendance = matchesPlayed / signups`

---

## 7. Season Management (Admin)

### 7.1 Create New Season
**Steps:**
1. Admin page → Season section
2. Enter season name
3. Set start/end dates
4. Toggle "Set as Active" (optional)
5. Save

**Expected:**
- Season created
- If set active, previous season deactivated
- New events inherit this season

### 7.2 Switch Active Season
**Steps:**
1. Admin page → Season section
2. Tap different season to activate

**Expected:**
- Selected season becomes active
- Previous active season status changes to "closed"

### 7.3 View Season Leaderboard
**Steps:**
1. Navigate to Season page with seasonId

**Expected:**
- Shows player rankings by total points
- Points = sum of eventPoints + adjustments
- Sorted descending by points

### 7.4 View Season Match History
**Steps:**
1. On Season page, view recent matches
2. Toggle "Show All" for full history

**Expected:**
- Shows matches with team names, date, result
- Tap match to see details

### 7.5 Manual Point Adjustment
**Steps:**
1. Admin page → Season section
2. Select season
3. Select player
4. Enter delta points (+/-)
5. Enter reason
6. Submit

**Expected:**
- Adjustment recorded in ledger
- Reflected in season leaderboard
- Shows in player's season stats breakdown

---

## 8. Player Directory

### 8.1 View All Players
**Steps:**
1. Navigate to Players page

**Expected:**
- List of all active players
- Shows name, gender, NTRP

### 8.2 Filter by Gender
**Steps:**
1. Select gender filter (Male/Female/All)

**Expected:**
- List filtered accordingly

### 8.3 Sort Players
**Steps:**
1. Select sort option (NTRP/Name)

**Expected:**
- NTRP: Descending order
- Name: Alphabetical order

---

## 9. Admin Player Management

### 9.1 Create Player (Admin)
**Steps:**
1. Admin page → Player section
2. Enter name, gender, NTRP
3. Optionally add notes
4. Save

**Expected:**
- Player created without wechatOpenId
- Appears in player list
- Can be used in ad-hoc matches

### 9.2 Edit Player (Admin)
**Steps:**
1. Select existing player
2. Modify fields
3. Save

**Expected:**
- Player updated
- Changes reflected immediately

### 9.3 Admin Signup
**Steps:**
1. Admin page → Signup section
2. Select player
3. Select event
4. Submit

**Expected:**
- Player signed up for event
- Appears in event signup list

---

## 10. Settings & i18n

### 10.1 Switch Language
**Steps:**
1. Navigate to Settings page
2. Toggle language (English/中文)

**Expected:**
- All UI text switches language
- Preference persisted

### 10.2 Language Auto-Detection
**Steps:**
1. Fresh install, system language = Chinese

**Expected:**
- App defaults to Mandarin

### 10.3 Language Persistence
**Steps:**
1. Set language to English
2. Close and reopen app

**Expected:**
- Language remains English

---

## 11. Data Import/Export (Admin)

### 11.1 Export Collection to CSV
**Steps:**
1. Admin page → Export section
2. Select collection (players/events/matches)
3. Tap Export

**Expected:**
- CSV downloaded with all records
- Proper escaping of special characters

### 11.2 Import CSV
**Steps:**
1. Admin page → Import section
2. Select collection
3. Paste/upload CSV
4. Submit

**Expected:**
- Records created/updated based on _id presence
- Type coercion for numeric fields

---

## 12. Permission & Auth

### 12.1 Admin Bootstrap
**Precondition:** Fresh database, no admins

**Steps:**
1. First user calls any admin function

**Expected:**
- User auto-granted admin
- Added to settings.adminOpenIds

### 12.2 Non-Admin Rejection
**Steps:**
1. Non-admin user tries admin operation

**Expected:**
- Error: "PERMISSION_DENIED"
- Operation blocked

### 12.3 Admin Check on All Admin Functions
**Functions requiring admin:**
- createEvent, updateEvent, completeEvent, reopenEvent
- generateMatchups, regenerateMatchups, approveMatchups
- enterResult (both modes)
- createSeason, setActiveSeason, adminAdjustSeasonPoints
- upsertPlayer (with playerId or createNew)
- signupEvent (with playerId)
- listPlayers (without mine:true)
- adminExportCSV, adminImportCSV
- recalculateStats

---

## 13. Error Handling

### 13.1 Event Not Found
**Steps:**
1. Navigate to event page with invalid eventId

**Expected:**
- Error message displayed
- Graceful handling

### 13.2 Match Not Found
**Steps:**
1. Try to enter result for non-existent matchId

**Expected:**
- Error: "MATCH_NOT_FOUND"

### 13.3 Duplicate Event Title
**Steps:**
1. Create event with title that already exists

**Expected:**
- Error: "DUPLICATE_EVENT_TITLE"
- Event not created

### 13.4 Invalid Match Types
**Steps:**
1. Create event with all invalid match types

**Expected:**
- Error: "INVALID_MATCH_TYPES"

---

## 14. Edge Cases

### 14.1 Single Player Signup
**Steps:**
1. Only 1 player signs up for mens_singles
2. Generate matchups

**Expected:**
- Player goes to waitlist
- No match created

### 14.2 Odd Number of Players
**Steps:**
1. 3 players sign up for mens_singles
2. Generate matchups

**Expected:**
- 1 match created (2 players)
- 1 player on waitlist

### 14.3 No Preferred Match Types
**Steps:**
1. Player signs up without selecting preferred types
2. Generate matchups

**Expected:**
- Player considered for all allowed event match types

### 14.4 Cross-Gender Match Type Mismatch
**Steps:**
1. Male player selects womens_singles preference
2. Generate matchups

**Expected:**
- Player excluded from womens_singles (gender filter)
- May be matched in other compatible types

### 14.5 Empty Event Completion
**Steps:**
1. Event with no matches/results
2. Complete event

**Expected:**
- Event marked completed
- Empty playerPoints map
- No errors

---

## 15. Navigation & UI

### 15.1 Index Navigation
**From Index, can navigate to:**
- Event detail (tap event)
- Profile
- Matches
- Stats
- Players
- Settings
- Admin

### 15.2 Pull-to-Refresh
**Pages with refresh:**
- Index (events)
- Matches
- Players
- Stats

**Expected:**
- Data reloaded from source

### 15.3 Back Navigation
**All pages should:**
- Support back navigation
- Preserve state where appropriate

---

## Testing Tips

1. **Local Mode First:** Always test in devMode before CloudBase
2. **Check Console:** Errors logged to console in dev mode
3. **Reset Data:** Restart app to reset in-memory data
4. **Test Both Languages:** Verify all flows in EN and ZH
5. **Admin vs Regular:** Test same flows as both user types
