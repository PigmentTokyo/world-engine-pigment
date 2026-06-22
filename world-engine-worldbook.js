// world-engine-worldbook.js — 当前聊天世界书读取与后台推演选择
window.WORLD_ENGINE_WORLDBOOK = (function() {
  const STORAGE_PREFIX = 'world_engine_worldbook_selection_';
  const OVERRIDE_VALUES = ['const', 'key', 'off'];
  let worldInfoModulePromise = null;

  function getChatId() {
    return window.WORLD_ENGINE_CORE?.getChatId?.() || 'default';
  }

  function getSelectionKey() {
    return STORAGE_PREFIX + getChatId();
  }

  function sanitizeOverrides(obj) {
    const out = {};
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(function(key) {
        if (typeof key === 'string' && OVERRIDE_VALUES.indexOf(obj[key]) !== -1) out[key] = obj[key];
      });
    }
    return out;
  }

  function parseStored(raw) {
    try {
      const data = JSON.parse(raw || '[]');
      if (Array.isArray(data)) return { ids: data.filter(id => typeof id === 'string'), t: 0, overrides: {} };
      if (data && Array.isArray(data.ids)) {
        return {
          ids: data.ids.filter(id => typeof id === 'string'),
          t: Number(data.t) || 0,
          overrides: sanitizeOverrides(data.overrides)
        };
      }
    } catch (e) {}
    return { ids: [], t: 0, overrides: {} };
  }

  function readStored() {
    return parseStored(window.WORLD_ENGINE_STORE.getItem(getSelectionKey()));
  }

  function getSelectedIds() {
    return readStored().ids;
  }

  function getOverrides() {
    return readStored().overrides;
  }

  function hasSelection() {
    return window.WORLD_ENGINE_STORE.getItem(getSelectionKey()) !== null;
  }

  function removeOldestOtherSelection() {
    const currentKey = getSelectionKey();
    let oldestKey = null;
    let oldestT = Infinity;
    for (const key of window.WORLD_ENGINE_STORE.keys()) {
      if (!key || !key.startsWith(STORAGE_PREFIX) || key === currentKey) continue;
      const t = parseStored(window.WORLD_ENGINE_STORE.getItem(key)).t;
      if (t < oldestT) { oldestT = t; oldestKey = key; }
    }
    if (oldestKey) {
      window.WORLD_ENGINE_STORE.removeItem(oldestKey);
      return true;
    }
    return false;
  }

  function persistSelection(ids, overrides) {
    const uniqueIds = [...new Set(Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : [])];
    const idSet = new Set(uniqueIds);
    const cleanOverrides = sanitizeOverrides(overrides);
    const trimmedOverrides = {};
    Object.keys(cleanOverrides).forEach(function(id) {
      if (idSet.has(id)) trimmedOverrides[id] = cleanOverrides[id];
    });
    const value = JSON.stringify({ ids: uniqueIds, t: Date.now(), overrides: trimmedOverrides });
    const currentKey = getSelectionKey();
    while (true) {
      try {
        window.WORLD_ENGINE_STORE.setItem(currentKey, value);
        return;
      } catch (e) {
        if (!removeOldestOtherSelection()) throw e;
      }
    }
  }

  function saveSelectedIds(ids) {
    persistSelection(ids, readStored().overrides);
  }

  function saveSelection(ids, overrides) {
    persistSelection(ids, overrides);
  }

  function getEntryId(entry) {
    return `${entry.world || '未知世界书'}::${entry.uid}`;
  }

  function getEntryTitle(entry) {
    const comment = String(entry.comment || '').trim();
    if (comment) return comment;
    const keys = Array.isArray(entry.key) ? entry.key.filter(Boolean).join('、') : '';
    if (keys) return keys;
    const content = String(entry.content || '').trim();
    return content ? content.substring(0, 40) : `条目 ${entry.uid}`;
  }

  async function getWorldInfoModule() {
    if (!worldInfoModulePromise) {
      worldInfoModulePromise = import('/scripts/world-info.js').catch(error => {
        worldInfoModulePromise = null;
        throw error;
      });
    }
    return worldInfoModulePromise;
  }

  async function loadCurrentEntries() {
    const module = await getWorldInfoModule();
    if (typeof module.getSortedEntries !== 'function') {
      throw new Error('当前 SillyTavern 版本不支持读取世界书条目');
    }
    const entries = await module.getSortedEntries();
    return (Array.isArray(entries) ? entries : [])
      .filter(entry => entry && entry.uid !== undefined && String(entry.content || '').trim())
      .filter(entry => !getEntryTitle(entry).startsWith('TavernDB-ACU'))
      .map(entry => ({
        id: getEntryId(entry),
        uid: entry.uid,
        world: entry.world || '未知世界书',
        title: getEntryTitle(entry),
        content: String(entry.content || '').trim(),
        disabled: entry.disable === true || entry.enabled === false,
        constant: entry.constant === true,
        vectorized: entry.vectorized === true,
        selective: entry.selective === true,
        selectiveLogic: Number(entry.selectiveLogic) || 0,
        keys: Array.isArray(entry.key) ? entry.key.filter(k => typeof k === 'string' && k.trim()) : [],
        secondaryKeys: Array.isArray(entry.keysecondary) ? entry.keysecondary.filter(k => typeof k === 'string' && k.trim()) : [],
        caseSensitive: entry.caseSensitive === true,
        matchWholeWords: entry.matchWholeWords === true
      }));
  }

  function triggerEnabled() {
    const api = window.WORLD_ENGINE_API;
    const settings = api && api.getSettings ? api.getSettings() : {};
    return settings.worldbookTrigger === true;
  }

  function parseRegexKey(str) {
    const match = /^\/(.+)\/([a-z]*)$/i.exec(str);
    if (!match) return null;
    try { return new RegExp(match[1], match[2]); } catch (e) { return null; }
  }

  function matchKey(text, key, caseSensitive, matchWholeWords) {
    if (typeof key !== 'string' || !text) return false;
    const needle = key.trim();
    if (!needle) return false;
    const regex = parseRegexKey(needle);
    if (regex) { try { return regex.test(text); } catch (e) { return false; } }
    const haystack = caseSensitive ? text : text.toLowerCase();
    const target = caseSensitive ? needle : needle.toLowerCase();
    if (matchWholeWords && /[A-Za-z0-9_]/.test(needle) && /^[\x00-\x7F]+$/.test(needle)) {
      const esc = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      try { return new RegExp('(?:^|\\W)(?:' + esc + ')(?:\\W|$)', caseSensitive ? '' : 'i').test(text); } catch (e) {}
    }
    return haystack.indexOf(target) !== -1;
  }

  const LOGIC = { AND_ANY: 0, NOT_ALL: 1, NOT_ANY: 2, AND_ALL: 3 };

  function activationOf(entry, scanText, overrideMode) {
    const mode = overrideMode || 'auto';
    if (mode === 'off') return { active: false, reason: '关闭(覆写)' };
    if (mode === 'const') return { active: true, reason: '强制常驻(覆写)' };
    if (mode === 'auto' && entry.constant) return { active: true, reason: '常驻' };

    const primary = entry.keys || [];
    if (!primary.length) return { active: false, reason: entry.vectorized ? '向量条目(不触发)' : '无主关键词' };
    const hitKey = primary.find(key => matchKey(scanText, key, entry.caseSensitive, entry.matchWholeWords));
    if (!hitKey) return { active: false, reason: '未命中' };
    const secondary = entry.secondaryKeys || [];
    if (!entry.selective || !secondary.length) return { active: true, reason: '命中「' + hitKey + '」' };
    const anySec = secondary.some(key => matchKey(scanText, key, entry.caseSensitive, entry.matchWholeWords));
    const allSec = secondary.every(key => matchKey(scanText, key, entry.caseSensitive, entry.matchWholeWords));
    let ok;
    switch (entry.selectiveLogic) {
      case LOGIC.AND_ALL: ok = allSec; break;
      case LOGIC.NOT_ALL: ok = !allSec; break;
      case LOGIC.NOT_ANY: ok = !anySec; break;
      default: ok = anySec;
    }
    return { active: ok, reason: ok ? ('命中「' + hitKey + '」+次键') : '主命中但次键逻辑不满足' };
  }

  async function buildPromptSection(scanText) {
    const stored = readStored();
    const selectedIds = new Set(stored.ids);
    if (!selectedIds.size) return '';

    try {
      const entries = await loadCurrentEntries();
      const pool = entries.filter(entry => selectedIds.has(entry.id) && !entry.disabled);
      if (!pool.length) return '';
      let selectedEntries = pool;
      if (triggerEnabled()) {
        const text = String(scanText || '');
        const decided = pool.map(entry => {
          const result = activationOf(entry, text, stored.overrides[entry.id]);
          return { entry, active: result.active, reason: result.reason };
        });
        selectedEntries = decided.filter(item => item.active).map(item => item.entry);
        try {
          console.groupCollapsed('[世界引擎] 世界书蓝绿灯：' + selectedEntries.length + '/' + pool.length + ' 注入');
          decided.forEach(item => console.log((item.active ? '注入' : '跳过') + ' | ' + item.reason + ' | ' + item.entry.world + ' / ' + item.entry.title));
          console.groupEnd();
        } catch (e) {}
      }
      if (!selectedEntries.length) return '';
      const content = selectedEntries.map(entry => `【${entry.world} / ${entry.title}】\n${entry.content}`).join('\n\n');
      return `========== 已选世界书条目 ==========
以下内容是当前聊天的世界观事实与约束。后台推演必须遵守；不得擅自改写其既定设定。

${content}`;
    } catch(error) {
      console.warn('[世界引擎] 读取已选世界书失败:', error);
      return '';
    }
  }

  function pickString(source, keys) {
    for (const key of keys) {
      const value = source && source[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      const nested = source && source.data && source.data[key];
      if (typeof nested === 'string' && nested.trim()) return nested.trim();
    }
    return '';
  }

  function getCurrentCharacterObject(ctx) {
    if (!ctx) return null;
    if (ctx.character && typeof ctx.character === 'object') return ctx.character;
    const chars = Array.isArray(ctx.characters) ? ctx.characters : [];
    const ids = [ctx.characterId, ctx.this_chid, ctx.character_id, ctx.chid];
    for (const id of ids) {
      if (id === undefined || id === null || id === '') continue;
      const byIndex = chars[Number(id)];
      if (byIndex) return byIndex;
      const byKey = chars.find(ch => ch && (ch.avatar === id || ch.name === id || ch.id === id));
      if (byKey) return byKey;
    }
    if (ctx.name2) {
      const byName = chars.find(ch => ch && ch.name === ctx.name2);
      if (byName) return byName;
    }
    return chars[0] || null;
  }

  function loadCurrentCharacterProfile() {
    const ctx = window.SillyTavern?.getContext?.();
    const character = getCurrentCharacterObject(ctx);
    const name = pickString(character, ['name']) || pickString(ctx, ['name2', 'characterName']);
    const parts = [];
    if (name) parts.push('【角色名】\n' + name);
    const description = pickString(character, ['description', 'desc']);
    if (description) parts.push('【角色描述】\n' + description);
    const personality = pickString(character, ['personality', 'personality_summary']);
    if (personality) parts.push('【性格】\n' + personality);
    const scenario = pickString(character, ['scenario', 'world_scenario']);
    if (scenario) parts.push('【场景/背景】\n' + scenario);
    const creatorNotes = pickString(character, ['creator_notes', 'creator_notes_multilingual', 'notes']);
    if (creatorNotes) parts.push('【作者备注】\n' + creatorNotes);
    const mesExample = pickString(character, ['mes_example', 'example_dialogue']);
    if (mesExample) parts.push('【示例对话】\n' + mesExample);
    const text = parts.join('\n\n').trim();
    return text.length > 8000 ? text.substring(0, 8000) + '\n\n[...角色卡内容过长，已截断...]' : text;
  }

  return {
    getChatId,
    hasSelection,
    getSelectedIds,
    getOverrides,
    saveSelectedIds,
    saveSelection,
    loadCurrentEntries,
    loadCurrentCharacterProfile,
    triggerEnabled,
    activationOf,
    buildPromptSection
  };
})();