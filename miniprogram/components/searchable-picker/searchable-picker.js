// ABOUTME: Searchable dropdown component for selecting players.
// ABOUTME: Supports filtering by name and multiple selection.

Component({
  properties: {
    items: {
      type: Array,
      value: []
    },
    selectedIds: {
      type: Array,
      value: []
    },
    excludeIds: {
      type: Array,
      value: []
    },
    placeholder: {
      type: String,
      value: 'Search...'
    },
    maxSelect: {
      type: Number,
      value: 1
    }
  },

  data: {
    searchText: '',
    filteredItems: [],
    showList: false,
    selectedMap: {},
    selectedItems: []
  },

  observers: {
    'items, searchText, excludeIds': function(items, searchText, excludeIds) {
      const query = (searchText || '').toLowerCase().trim();
      const excludeArray = Array.isArray(excludeIds) ? excludeIds : [];
      const excludeSet = new Set(excludeArray);
      const itemsArray = Array.isArray(items) ? items : [];
      let filtered = itemsArray.filter(item => item && !excludeSet.has(item._id));
      if (query) {
        filtered = filtered.filter(item =>
          (item.name || '').toLowerCase().includes(query)
        );
      }
      this.setData({ filteredItems: filtered });
    },
    'selectedIds, items': function(selectedIds, items) {
      const ids = Array.isArray(selectedIds) ? selectedIds : [];
      const itemsArray = Array.isArray(items) ? items : [];
      const map = {};
      ids.forEach(id => { map[id] = true; });
      const selectedItems = itemsArray.filter(item => item && map[item._id]);
      this.setData({ selectedMap: map, selectedItems });
    }
  },

  methods: {
    onSearchInput(e) {
      this.setData({
        searchText: e.detail.value,
        showList: true
      });
    },

    onFocus() {
      this.setData({ showList: true });
    },

    onBlur() {
      setTimeout(() => {
        this.setData({ showList: false });
      }, 200);
    },

    onSelect(e) {
      const id = e.currentTarget.dataset.id;
      const current = this.data.selectedIds || [];
      let newSelected;

      if (current.includes(id)) {
        newSelected = current.filter(i => i !== id);
      } else if (current.length < this.data.maxSelect) {
        newSelected = [...current, id];
      } else if (this.data.maxSelect === 1) {
        newSelected = [id];
      } else {
        return;
      }

      this.triggerEvent('change', { selectedIds: newSelected });
    },

    clearSelection() {
      this.triggerEvent('change', { selectedIds: [] });
    }
  }
});
