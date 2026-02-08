// ABOUTME: Event detail page showing event info and signup form for players.
// ABOUTME: Displays event details and allows players to sign up with availability and match preferences.

const { initCloud, callFunction } = require('../../utils/cloud');
const i18n = require('../../utils/i18n');

function getMatchTypes() {
  const strs = i18n.getStrings();
  return [
    { value: 'mens_singles', label: strs.match_mens_singles },
    { value: 'womens_singles', label: strs.match_womens_singles },
    { value: 'mens_doubles', label: strs.match_mens_doubles },
    { value: 'womens_doubles', label: strs.match_womens_doubles },
    { value: 'mixed_doubles', label: strs.match_mixed_doubles }
  ];
}

Page({
  data: {
    i18n: {},
    eventId: '',
    event: null,
    signupStatus: '',
    signedUpPlayers: [],
    matches: []
  },
  onLoad(query) {
    initCloud();
    this.loadI18n();
    const eventId = query.eventId || '';
    this.setData({ eventId });
    this.fetchEvent();
  },
  onShow() {
    this.loadI18n();
  },
  loadI18n() {
    this.setData({
      i18n: i18n.getStrings()
    });
  },
  fetchEvent() {
    callFunction('listEvents', { eventId: this.data.eventId })
      .then(res => {
        const event = (res.result.events || [])[0] || null;
        this.setData({ event });
        return Promise.all([
          callFunction('listSignups', { eventId: this.data.eventId, mine: true }),
          callFunction('listSignups', { eventId: this.data.eventId, includeNames: true }),
          callFunction('listMatches', { eventId: this.data.eventId }),
          callFunction('listPlayers', {})
        ]);
      })
      .then(results => {
        const r0 = (results[0] && results[0].result) || {};
        const r1 = (results[1] && results[1].result) || {};
        const r2 = (results[2] && results[2].result) || {};
        const r3 = (results[3] && results[3].result) || {};

        const mySignup = (r0.signups || [])[0];
        const allSignups = r1.signups || [];
        const allMatches = r2.matches || [];
        const allPlayers = r3.players || [];

        const signedUpPlayers = allSignups.map(s => ({
          playerId: s.playerId,
          name: s.playerName || 'Unknown',
          ntrp: s.playerNtrp
        }));

        const playerMap = new Map(allPlayers.map(p => [p._id, p.name || 'Unknown']));
        const matches = allMatches
          .filter(m => m.status === 'approved' || m.status === 'published' || m.status === 'completed')
          .map(m => {
            const typeObj = getMatchTypes().find(t => t.value === m.matchType);
            return {
              ...m,
              teamANames: (m.teamA || []).map(id => playerMap.get(id) || id).join(', '),
              teamBNames: (m.teamB || []).map(id => playerMap.get(id) || id).join(', '),
              matchTypeLabel: typeObj ? typeObj.label : m.matchType
            };
          });

        this.setData({
          signupStatus: mySignup ? mySignup.status : '',
          signedUpPlayers,
          matches
        });
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: 'Failed to load event', icon: 'none' });
      });
  },
  signup() {
    callFunction('signupEvent', {
      eventId: this.data.eventId
    })
      .then(() => {
        wx.showToast({ title: 'Signed up', icon: 'success' });
        this.fetchEvent();
      })
      .catch(err => {
        console.error(err);
        let message = err.message || 'Signup failed';
        if (err.message === 'MISSING_PROFILE') {
          message = this.data.i18n.event_no_profile;
        } else if (err.message === 'PROFILE_INCOMPLETE') {
          message = this.data.i18n.event_profile_incomplete;
        }
        wx.showToast({ title: message, icon: 'none', duration: 3000 });
      });
  },
  withdraw() {
    callFunction('withdrawEvent', {
      eventId: this.data.eventId
    })
      .then(() => {
        wx.showToast({ title: 'Withdrawn', icon: 'success' });
        this.fetchEvent();
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: err.message || 'Withdraw failed', icon: 'none' });
      });
  }
});
