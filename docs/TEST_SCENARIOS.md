# Test Scenarios

Manual testing scenarios for the WeChat Tennis Mini Program. Test on the WeChat DevTools simulator.

## Event Status Flow

The simplified event status flow:
- `open` → `in_progress` → `completed`

### Scenario 1: Basic Event Lifecycle

**Steps:**
1. Go to Admin page
2. Create a new event with title "Test Event", date, and location
3. Verify event appears in the event list with status `open`
4. Sign up at least 4 test players for the event
5. Click "Generate Matchups"
6. Verify event status changes to `in_progress`
7. View matchups modal - verify matches are created
8. Enter results for all matches
9. Click "Complete Event"
10. Verify event status changes to `completed`

**Expected:**
- Event progresses through statuses correctly
- Matchups are visible after generation
- Results can be entered for in_progress events

### Scenario 2: Regenerate Matchups Blocked

**Steps:**
1. Create a new event
2. Sign up 4 players
3. Generate matchups (event becomes `in_progress`)
4. Try to click "Generate Matchups" again

**Expected:**
- Error message: "Cannot regenerate matchups once event is in progress"
- Event remains in `in_progress` status
- Existing matchups are preserved

### Scenario 3: Manual Matchup Management

**Steps:**
1. Create an event and generate matchups
2. Open the matchups modal
3. Click "Add Matchup"
4. Select match type, Team A players, Team B players
5. Save the matchup
6. Verify new matchup appears in the list
7. Delete an existing matchup
8. Verify matchup is removed

**Expected:**
- Admin can add matchups manually during `in_progress`
- Admin can delete matchups during `in_progress`
- Cannot add/delete matchups for `completed` events

### Scenario 4: Players Can Sign Up During In-Progress

**Steps:**
1. Create an event with status `open`
2. Sign up 2 players
3. Generate matchups (event becomes `in_progress`)
4. Go to the event detail page
5. Sign up another player

**Expected:**
- Player signup succeeds even when event is `in_progress`
- New player does not automatically get a matchup (admin must add manually)

### Scenario 5: Complete Event Validation

**Steps:**
1. Create a new event (status: `open`)
2. Try to click "Complete Event"

**Expected:**
- Error message: "Event must be in progress to complete"
- Event remains in `open` status

### Scenario 6: Reopen and Re-complete Event

**Steps:**
1. Complete an event (follow Scenario 1)
2. Click "Reopen Event"
3. Verify status changes to `in_progress`
4. Modify a match result
5. Click "Complete Event" again

**Expected:**
- Event can be reopened from `completed`
- Status reverts to `in_progress`
- Previous playerPoints are cleared
- New playerPoints calculated on re-completion

### Scenario 7: Reopen Event Validation

**Steps:**
1. Create an event with status `open`
2. Try to reopen the event (should not be possible from UI)
3. Generate matchups to get to `in_progress`
4. Try to reopen (should not be possible from UI)

**Expected:**
- "Reopen Event" button only visible for `completed` events
- Cannot reopen events that are not completed

## Match Types

### Scenario 8: Singles Match Generation

**Steps:**
1. Create an event allowing only men's singles
2. Sign up 4 male players (e.g., NTRP 3.0, 3.5, 4.0, 4.5)
3. Generate matchups

**Expected:**
- 2 matches created: (3.0 vs 3.5) and (4.0 vs 4.5)
- Players paired by adjacent NTRP

### Scenario 9: Doubles Match Generation

**Steps:**
1. Create an event allowing only men's doubles
2. Sign up 8 male players with varying NTRP
3. Generate matchups

**Expected:**
- 2 matches created (4 players per match)
- Teams formed first, then teams paired by combined NTRP

### Scenario 10: Mixed Doubles Generation

**Steps:**
1. Create an event allowing mixed doubles
2. Sign up 4 male and 4 female players
3. Generate matchups

**Expected:**
- 2 matches created
- Each team has 1 male + 1 female
- Teams paired by combined NTRP

### Scenario 11: Waitlist for Odd Players

**Steps:**
1. Create an event
2. Sign up 3 players for men's singles
3. Generate matchups

**Expected:**
- 1 match created (2 players)
- 1 player on waitlist
- Waitlist shown in matchups modal

## Test Players

### Scenario 12: Create Test Player

**Steps:**
1. Go to Admin page, "Test Players" section
2. Enter name, select gender, select NTRP
3. Click "Add Test Player"

**Expected:**
- Test player created with `isTestPlayer: true`
- Player appears in test player list
- Player can be signed up for events

### Scenario 13: Delete Test Player

**Steps:**
1. Have at least one test player
2. Select test player from dropdown
3. Click "Delete Player"
4. Confirm deletion

**Expected:**
- Test player removed from list
- Player no longer available for signups

## Result Entry

### Scenario 14: Enter Result from Matchmaking

**Steps:**
1. Generate matchups for an event
2. Go to "Enter Result" section, select "From Matchmaking"
3. Select the event
4. Select a match from the list
5. Enter set scores (e.g., 6-4, 6-3)
6. Select winner (Team A or Team B)
7. Save result

**Expected:**
- Match status changes to `completed`
- Score displayed correctly (e.g., "6-4 6-3")
- Match no longer appears in pending matches

### Scenario 15: Enter Ad-Hoc Result

**Steps:**
1. Go to "Enter Result" section, select "Ad-hoc Match"
2. Select match type
3. Select players for Team A and Team B
4. Enter set scores
5. Select winner
6. Save result

**Expected:**
- New match created with status `adhoc`
- Result recorded correctly
- Stats updated for participating players

### Scenario 16: Multiple Sets

**Steps:**
1. Enter a result
2. Add additional sets (click "+ Add Set")
3. Enter scores for each set
4. Save result

**Expected:**
- All set scores recorded
- Final score shows all sets (e.g., "6-4 3-6 7-5")

## Season Management

### Scenario 17: Event Points Calculation

**Steps:**
1. Create a season and set it active
2. Create an event (inherits active season)
3. Generate matchups and enter results
4. Complete the event

**Expected:**
- `playerPoints` map stored on event document
- 1 point per match won
- Season leaderboard reflects points

### Scenario 18: Season Stats Aggregation

**Steps:**
1. Complete multiple events in same season
2. View season results page

**Expected:**
- Points aggregated from all completed events
- Players ranked by total points

## Error Handling

### Scenario 19: Incomplete Profile Signup

**Steps:**
1. Create a player without NTRP
2. Try to sign up for an event

**Expected:**
- Error: "Profile incomplete"
- Signup blocked until profile complete

### Scenario 20: Permission Denied

**Steps:**
1. (In production mode with non-admin user)
2. Try to access admin functions

**Expected:**
- Error: "Permission denied"
- Admin functions blocked

## Internationalization

### Scenario 21: Language Switch

**Steps:**
1. Go to Settings page
2. Switch language from English to Chinese
3. Navigate through the app

**Expected:**
- All UI text in Chinese
- Error messages in Chinese
- Switch back to English works

## Status Badge Display

### Scenario 22: Status Badge Colors

**Steps:**
1. Create events in different statuses
2. View admin event list

**Expected:**
- `open` - One color (e.g., green)
- `in_progress` - Different color (e.g., blue)
- `completed` - Different color (e.g., gray)
