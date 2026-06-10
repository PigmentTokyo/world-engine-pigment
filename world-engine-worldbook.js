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

  function getSelectedIds() {
    try {
      const saved = JSON.parse(localStorage.getItem(getSelectionKey()) || '[]');
      return Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : [];
    } catch(e) {
      return [];
    }
  }

  function saveSelectedIds(ids) {
    const uniqueIds = [...new Set(Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : [])];
    localStorage.setItem(getSelectionKey(), JSON.stringify(uniqueIds));
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
      const selectedEntries = entries.filter(entry => selectedIds.has(entry.id));
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
    getSelectedIds,
    saveSelectedIds,
    loadCurrentEntries,
    buildPromptSection
  };
})();
