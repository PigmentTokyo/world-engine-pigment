// world-engine-worldbook.js — 当前聊天世界书读取与后台推演选择
window.WORLD_ENGINE_WORLDBOOK = (function() {
  const STORAGE_PREFIX = 'world_engine_worldbook_selection_';
  let worldInfoModulePromise = null;

  function getChatId() {
    return window.WORLD_ENGINE_CORE?.getChatId?.() || 'default';
  }

  function getSelectionKey() {
    return STORAGE_PREFIX + getChatId();
  }

  // 解析存储值，兼容老格式（纯数组）与新格式（{ids, t}）
  function parseStored(raw) {
    try {
      const data = JSON.parse(raw || '[]');
      if (Array.isArray(data)) return { ids: data.filter(id => typeof id === 'string'), t: 0 };
      if (data && Array.isArray(data.ids)) {
        return { ids: data.ids.filter(id => typeof id === 'string'), t: Number(data.t) || 0 };
      }
    } catch (e) {}
    return { ids: [], t: 0 };
  }

  function getSelectedIds() {
    return parseStored(localStorage.getItem(getSelectionKey())).ids;
  }

  // 找出最老的一条其它聊天的选择记录（按保存时间戳；老格式无时间戳视为最老）
  function removeOldestOtherSelection() {
    const currentKey = getSelectionKey();
    let oldestKey = null;
    let oldestT = Infinity;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX) || key === currentKey) continue;
      const t = parseStored(localStorage.getItem(key)).t;
      if (t < oldestT) {
        oldestT = t;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      localStorage.removeItem(oldestKey);
      return true;
    }
    return false;
  }

  function saveSelectedIds(ids) {
    const uniqueIds = [...new Set(Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : [])];
    const value = JSON.stringify({ ids: uniqueIds, t: Date.now() });
    const currentKey = getSelectionKey();
    // 配额超限：每次只删掉最老的一条其它聊天记录，删到塞得下为止
    while (true) {
      try {
        localStorage.setItem(currentKey, value);
        return;
      } catch (e) {
        if (!removeOldestOtherSelection()) throw e;
      }
    }
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
      // 完全无视 TavernDB-ACU 开头的条目：不显示、不可选、不注入
      .filter(entry => !getEntryTitle(entry).startsWith('TavernDB-ACU'))
      .map(entry => ({
        id: getEntryId(entry),
        uid: entry.uid,
        world: entry.world || '未知世界书',
        title: getEntryTitle(entry),
        content: String(entry.content || '').trim(),
        disabled: entry.disable === true || entry.enabled === false
      }));
  }

  async function buildPromptSection() {
    const selectedIds = new Set(getSelectedIds());
    if (!selectedIds.size) return '';

    try {
      const entries = await loadCurrentEntries();
      const selectedEntries = entries.filter(entry => selectedIds.has(entry.id) && !entry.disabled);
      if (!selectedEntries.length) return '';

      const content = selectedEntries.map(entry =>
        `【${entry.world} / ${entry.title}】\n${entry.content}`
      ).join('\n\n');

      return `========== 已选世界书条目 ==========
以下内容是当前聊天的世界观事实与约束。后台推演必须遵守；不得擅自改写其既定设定。

${content}`;
    } catch(error) {
      console.warn('[世界引擎] 读取已选世界书失败:', error);
      return '';
    }
  }

  return {
    getChatId,
    getSelectedIds,
    saveSelectedIds,
    loadCurrentEntries,
    buildPromptSection
  };
})();
