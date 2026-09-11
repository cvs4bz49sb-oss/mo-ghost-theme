/* Shared by the Ask UI and its background worker. Full answers live in IndexedDB;
   legacy localStorage exports remain readable by Desk and the existing sync layer. */
(function (root) {
  'use strict';
  let dbPromise;
  const open = () => dbPromise || (dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open('fr-conversations', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('conversations', { keyPath: 'id' });
      db.createObjectStore('meta', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
  async function transaction(store, mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode), req = action(tx.objectStore(store));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Storage transaction interrupted'));
    });
  }
  const api = {
    all: () => transaction('conversations', 'readonly', s => s.getAll()),
    get: id => transaction('conversations', 'readonly', s => s.get(id)),
    put: c => transaction('conversations', 'readwrite', s => s.put(c)),
    meta: id => transaction('meta', 'readonly', s => s.get(id)),
    setMeta: (id, value) => transaction('meta', 'readwrite', s => s.put({ id, value })),
    // Atomically update one conversation so another tab cannot overwrite a streaming turn.
    async update(id, change) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('conversations', 'readwrite'), s = tx.objectStore('conversations');
        let result;
        const req = s.get(id);
        req.onsuccess = () => { if (req.result) { result = change(req.result) || req.result; s.put(result); } };
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Storage transaction interrupted'));
      });
    },
    id: () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
  };
  root.FRChatStore = api;
})(globalThis);
