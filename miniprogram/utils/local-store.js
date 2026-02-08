// ABOUTME: In-memory data store for local development mode.
// ABOUTME: Provides a Collection class that mimics WeChat CloudBase database operations.

const DEV_USER_OPENID = 'DEV_USER_001';

function generateId() {
  return 'local_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

class Collection {
  constructor(name, store) {
    this._name = name;
    this._store = store;
    this._query = {};
    this._docId = null;
  }

  doc(id) {
    const col = new Collection(this._name, this._store);
    col._docId = id;
    return col;
  }

  where(query) {
    const col = new Collection(this._name, this._store);
    col._query = { ...this._query, ...query };
    return col;
  }

  async get() {
    const data = this._store.getData(this._name);
    if (this._docId) {
      const doc = data.find(d => d._id === this._docId);
      if (!doc) {
        throw new Error('DOCUMENT_NOT_FOUND');
      }
      return { data: doc };
    }
    const filtered = data.filter(doc => this._matchesQuery(doc, this._query));
    return { data: filtered };
  }

  async count() {
    const data = this._store.getData(this._name);
    const filtered = data.filter(doc => this._matchesQuery(doc, this._query));
    return { total: filtered.length };
  }

  async add({ data }) {
    const id = generateId();
    const record = { _id: id, ...data };
    this._store.addRecord(this._name, record);
    return { _id: id };
  }

  async set({ data }) {
    if (!this._docId) {
      throw new Error('NO_DOC_ID_FOR_SET');
    }
    const existing = this._store.getData(this._name);
    const idx = existing.findIndex(d => d._id === this._docId);
    const record = { _id: this._docId, ...data };
    if (idx >= 0) {
      this._store.updateRecord(this._name, idx, record);
    } else {
      this._store.addRecord(this._name, record);
    }
    return { updated: 1 };
  }

  async update({ data }) {
    if (this._docId) {
      const existing = this._store.getData(this._name);
      const idx = existing.findIndex(d => d._id === this._docId);
      if (idx >= 0) {
        const updated = { ...existing[idx], ...data };
        this._store.updateRecord(this._name, idx, updated);
        return { updated: 1 };
      }
      return { updated: 0 };
    }
    const existing = this._store.getData(this._name);
    let count = 0;
    existing.forEach((doc, idx) => {
      if (this._matchesQuery(doc, this._query)) {
        const updated = { ...doc, ...data };
        this._store.updateRecord(this._name, idx, updated);
        count++;
      }
    });
    return { updated: count };
  }

  async remove() {
    if (this._docId) {
      const removed = this._store.removeRecord(this._name, this._docId);
      return { removed: removed ? 1 : 0 };
    }
    const existing = this._store.getData(this._name);
    let count = 0;
    for (let i = existing.length - 1; i >= 0; i--) {
      if (this._matchesQuery(existing[i], this._query)) {
        this._store.removeRecordByIndex(this._name, i);
        count++;
      }
    }
    return { removed: count };
  }

  _matchesQuery(doc, query) {
    for (const key of Object.keys(query)) {
      const condition = query[key];
      const docValue = doc[key];

      if (condition && typeof condition === 'object' && condition._type) {
        if (condition._type === 'in') {
          if (!condition._values.includes(docValue)) {
            if (Array.isArray(docValue)) {
              const hasMatch = condition._values.some(v => docValue.includes(v));
              if (!hasMatch) return false;
            } else {
              return false;
            }
          }
        }
      } else if (docValue !== condition) {
        return false;
      }
    }
    return true;
  }
}

class DbCommand {
  in(values) {
    return { _type: 'in', _values: values };
  }
}

class LocalStore {
  constructor() {
    this._data = {
      players: [],
      events: [],
      signups: [],
      matches: [],
      results: [],
      stats: [],
      settings: [],
      seasons: [],
      season_stats: [],
      season_point_adjustments: []
    };
    this._seedData();
  }

  _seedData() {
    const now = new Date().toISOString();
    const seasonId = 'local_season_001';

    this._data.settings.push({
      _id: 'core',
      adminOpenIds: [DEV_USER_OPENID],
      pointsConfig: { win: 3, loss: 1 },
      ntrpScaleConfig: {},
      activeSeasonId: seasonId
    });

    this._data.seasons.push({
      _id: seasonId,
      seasonId: seasonId,
      name: 'Dev Season',
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      status: 'active',
      pointsConfig: null,
      createdAt: now,
      closedAt: ''
    });

    this._data.players.push(
      {
        _id: 'local_player_001',
        playerId: 'local_player_001',
        wechatOpenId: DEV_USER_OPENID,
        name: 'Dev Admin',
        gender: 'M',
        ntrp: 4.0,
        isActive: true,
        notes: 'Development user'
      },
      {
        _id: 'local_player_002',
        playerId: 'local_player_002',
        wechatOpenId: 'DEV_USER_002',
        name: 'Alice Test',
        gender: 'F',
        ntrp: 3.5,
        isActive: true,
        notes: ''
      },
      {
        _id: 'local_player_003',
        playerId: 'local_player_003',
        wechatOpenId: 'DEV_USER_003',
        name: 'Bob Test',
        gender: 'M',
        ntrp: 3.5,
        isActive: true,
        notes: ''
      },
      {
        _id: 'local_player_004',
        playerId: 'local_player_004',
        wechatOpenId: 'DEV_USER_004',
        name: 'Carol Test',
        gender: 'F',
        ntrp: 4.0,
        isActive: true,
        notes: ''
      }
    );

    const eventId = 'local_event_001';
    this._data.events.push({
      _id: eventId,
      eventId: eventId,
      title: 'Dev Tennis Event',
      date: '2026-02-15',
      location: 'Test Courts',
      timeSlots: ['09:00', '10:30'],
      matchTypesAllowed: ['mens_singles', 'womens_singles', 'mixed_doubles'],
      status: 'open',
      waitlist: {},
      createdBy: DEV_USER_OPENID,
      createdAt: now,
      updatedAt: now,
      seasonId: seasonId
    });
  }

  getData(collection) {
    return this._data[collection] || [];
  }

  addRecord(collection, record) {
    if (!this._data[collection]) {
      this._data[collection] = [];
    }
    this._data[collection].push(record);
  }

  updateRecord(collection, index, record) {
    if (this._data[collection] && this._data[collection][index]) {
      this._data[collection][index] = record;
    }
  }

  removeRecord(collection, id) {
    if (!this._data[collection]) return false;
    const idx = this._data[collection].findIndex(d => d._id === id);
    if (idx >= 0) {
      this._data[collection].splice(idx, 1);
      return true;
    }
    return false;
  }

  removeRecordByIndex(collection, index) {
    if (this._data[collection] && this._data[collection][index]) {
      this._data[collection].splice(index, 1);
    }
  }

  collection(name) {
    return new Collection(name, this);
  }

  get command() {
    return new DbCommand();
  }
}

const store = new LocalStore();

module.exports = {
  store,
  DEV_USER_OPENID,
  generateId
};
