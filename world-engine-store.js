// world-engine-store.js — persistent key/value storage.
// Global and sensitive settings stay local. Chat-scoped engine data is mirrored
// into SillyTavern chat metadata so it can follow the conversation across devices.
window.WORLD_ENGINE_STORE = (function() {
  const DB_NAME = 'world_engine';
  const STORE_NAME = 'kv';
  const PREFIX = 'world_engine_';
  const CHAT_META_ROOT = 'world_engine';

  let db = null;
  let ready = false;
  const mirror = new Map();

  function getContext() {
    try {
      return window.SillyTavern && typeof window.SillyTavern.getContext === 'function'
        ? window.SillyTavern.getContext()
        : null;
    } catch (e) {
      return null;
    }
  }

  function getChatId() {
    try {
      if (window.WORLD_ENGINE_CORE && typeof window.WORLD_ENGINE_CORE.getChatId === 'function') {
        return window.WORLD_ENGINE_CORE.getChatId() || 'default';
      }
      const ctx = getContext();
      return (ctx && (ctx.chatId || ctx.chat_id || ctx.chat)) || 'default';
    } catch (e) {
      return 'default';
    }
  }

  function getChatMetadataRoot(create) {
    const ctx = getContext();
    const metadata = ctx && (ctx.chatMetadata || ctx.chat_metadata || ctx.metadata);
    if (!metadata || typeof metadata !== 'object') return null;
    if (create && (!metadata[CHAT_META_ROOT] || typeof metadata[CHAT_META_ROOT] !== 'object')) {
      metadata[CHAT_META_ROOT] = {};
    }
    return metadata[CHAT_META_ROOT] && typeof metadata[CHAT_META_ROOT] === 'object'
      ? metadata[CHAT_META_ROOT]
      : null;
  }

  function saveChatMetadata() {
    const ctx = getContext();
    try {
      if (ctx && typeof ctx.saveMetadataDebounced === 'function') ctx.saveMetadataDebounced();
      else if (ctx && typeof ctx.saveMetadata === 'function') ctx.saveMetadata();
    } catch (e) {
      console.warn('[WorldEngine Store] Failed to save chat metadata', e);
    }
  }

  function getChatScopedSlot(key) {
    const chatId = getChatId();
    const statePrefix = 'world_engine_' + chatId;
    if (key === statePrefix) return 'state';
    if (key === statePrefix + '_checkpoint') return 'checkpoint';
    if (key === statePrefix + '_anchorLayer') return 'anchorLayer';
    if (key === statePrefix + '_fingerprint') return 'fingerprint';
    if (key === statePrefix + '_customModuleState') return 'customModuleState';
    if (key === 'world_engine_worldbook_selection_' + chatId) return 'worldbookSelection';
    if (key === 'world_engine_tone_prompt_' + chatId) return 'tonePrompt';
    return null;
  }

  function readChatScoped(key) {
    const slot = getChatScopedSlot(key);
    if (!slot) return null;
    const root = getChatMetadataRoot(false);
    if (!root || !Object.prototype.hasOwnProperty.call(root, slot)) return null;
    const value = root[slot];
    return value == null ? null : String(value);
  }

  function writeChatScoped(key, value) {
    const slot = getChatScopedSlot(key);
    if (!slot) return false;
    const root = getChatMetadataRoot(true);
    if (!root) return false;
    root[slot] = String(value);
    root.version = 1;
    root.updatedAt = Date.now();
    saveChatMetadata();
    return true;
  }

  function removeChatScoped(key) {
    const slot = getChatScopedSlot(key);
    if (!slot) return false;
    const root = getChatMetadataRoot(false);
    if (!root || !Object.prototype.hasOwnProperty.call(root, slot)) return false;
    delete root[slot];
    root.updatedAt = Date.now();
    saveChatMetadata();
    return true;
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      let req;
      try {
        req = indexedDB.open(DB_NAME, 1);
      } catch (e) { reject(e); return; }
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE_NAME)) d.createObjectStore(STORE_NAME);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function idbGetAll() {
    return new Promise((resolve, reject) => {
      const out = [];
      const cur = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (c) { out.push([c.key, c.value]); c.continue(); }
        else resolve(out);
      };
      cur.onerror = () => reject(cur.error);
    });
  }

  function idbPut(key, value) {
    if (!db) return;
    try { db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(value, key); }
    catch (e) { console.warn('[WorldEngine Store] IndexedDB write failed', e); }
  }

  function idbDel(key) {
    if (!db) return;
    try { db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(key); }
    catch (e) {}
  }

  async function hydrate() {
    if (ready) return;
    try {
      db = await openDB();
      for (const [k, v] of await idbGetAll()) mirror.set(k, v);
    } catch (e) {
      console.warn('[WorldEngine Store] IndexedDB unavailable, falling back to localStorage', e);
      db = null;
    }
    try {
      const legacyKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) legacyKeys.push(k);
      }
      for (const k of legacyKeys) {
        const v = localStorage.getItem(k);
        if (v == null) continue;
        if (!mirror.has(k)) { mirror.set(k, v); idbPut(k, v); }
        if (db) localStorage.removeItem(k);
      }
      if (db && legacyKeys.length) {
        console.log('[WorldEngine Store] Migrated ' + legacyKeys.length + ' localStorage keys to IndexedDB');
      }
    } catch (e) {
      console.warn('[WorldEngine Store] Legacy migration failed', e);
    }
    ready = true;
  }

  function getItem(key) {
    const chatValue = readChatScoped(key);
    if (chatValue !== null) return chatValue;

    let localValue = null;
    if (mirror.has(key)) localValue = mirror.get(key);
    else {
      try { localValue = localStorage.getItem(key); } catch (e) { localValue = null; }
    }

    if (localValue !== null && getChatScopedSlot(key)) {
      writeChatScoped(key, localValue);
    }
    return localValue;
  }

  function setItem(key, value) {
    value = String(value);
    writeChatScoped(key, value);
    mirror.set(key, value);
    if (db) idbPut(key, value);
    else {
      try { localStorage.setItem(key, value); } catch (e) {}
    }
  }

  function removeItem(key) {
    removeChatScoped(key);
    mirror.delete(key);
    if (db) idbDel(key);
    else { try { localStorage.removeItem(key); } catch (e) {} }
  }

  function keys() {
    if (mirror.size || db) return [...mirror.keys()];
    const out = [];
    for (let i = 0; i < localStorage.length; i++) out.push(localStorage.key(i));
    return out;
  }

  return { hydrate, getItem, setItem, removeItem, keys };
})();
