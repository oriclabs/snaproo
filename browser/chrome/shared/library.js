// Snaproo — Image Library (IndexedDB)
// Persistent cross-tab image collection. Stores images as blobs.
//
// Usage:
//   await PixLibrary.add({ dataUrl, source, name, width, height, collection });
//   const items = await PixLibrary.getAll();
//   const collections = await PixLibrary.getCollections(); // sorted unique names
//   await PixLibrary.remove(id);
//   await PixLibrary.clear();
//   const usage = await PixLibrary.getUsage(); // { count, bytes }

const PixLibrary = {
  DB_NAME: 'snaproo-library',
  STORE: 'images',
  MAX_BYTES: 100 * 1024 * 1024, // 100MB limit

  _db: null,

  async _open() {
    if (this._db) return this._db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.STORE)) {
          const store = db.createObjectStore(this.STORE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('addedAt', 'addedAt');
          store.createIndex('source', 'source');
        }
      };
      req.onsuccess = () => { this._db = req.result; resolve(this._db); };
      req.onerror = () => reject(req.error);
    });
  },

  async add(item) {
    // item: { dataUrl, source, name, width, height, type, color, url, collection }
    const db = await this._open();
    const entry = {
      dataUrl: item.dataUrl || '',
      source: item.source || 'unknown',
      name: item.name || 'image-' + Date.now(),
      width: item.width || 0,
      height: item.height || 0,
      size: item.dataUrl?.length || 0,
      type: item.type || 'image', // 'image', 'color'
      color: item.color || null,
      url: item.url || '', // source page URL
      collection: item.collection || 'General',
      addedAt: Date.now(),
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, 'readwrite');
      const req = tx.objectStore(this.STORE).add(entry);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async getAll() {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, 'readonly');
      const req = tx.objectStore(this.STORE).index('addedAt').getAll();
      req.onsuccess = () => resolve(req.result.reverse()); // newest first
      req.onerror = () => reject(req.error);
    });
  },

  async get(id) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, 'readonly');
      const req = tx.objectStore(this.STORE).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async remove(id) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, 'readwrite');
      const req = tx.objectStore(this.STORE).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async clear() {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, 'readwrite');
      const req = tx.objectStore(this.STORE).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async getUsage() {
    const items = await this.getAll();
    let bytes = 0;
    items.forEach(i => { bytes += i.size || 0; });
    return { count: items.length, bytes };
  },

  async update(id, fields) {
    const db = await this._open();
    const item = await this.get(id);
    if (!item) return;
    Object.assign(item, fields);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, 'readwrite');
      const req = tx.objectStore(this.STORE).put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async getCollections() {
    const all = await this.getAll();
    const collections = new Set(['General']); // General always exists
    all.forEach(item => collections.add(item.collection || 'General'));
    return [...collections].sort();
  },

  // Migrate existing items without collection to "General"
  async migrateCollections() {
    const all = await this.getAll();
    for (const item of all) {
      if (!item.collection) {
        await this.update(item.id, { collection: 'General' });
      }
    }
  },

  formatBytes(b) {
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1024 / 1024).toFixed(1) + ' MB';
  }
};
