/**
 * world-engine-preset-ui.js
 * 世界引擎 — 预设管理界面 (World Engine Preset Management UI)
 *
 * 为世界引擎设置面板注入预设管理功能：
 * - 世界观预设选择与切换
 * - 自定义规则编辑器
 * - 术语表预览与编辑
 * - 预设详情编辑（仅限自定义预设）
 */
window.WORLD_ENGINE_PRESET_UI = (function () {
  'use strict';

  // ─────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────
  var _injected = false;
  var _generating = false;
  var _observer = null;
  var _generateMenuOpen = false;
  var _generateEntries = [];
  var _generateEntriesLoading = false;
  var _generateEntriesError = '';
  var _generateSelectedIds = null;
  var _generateGuidance = '';   // 内存暂存的生成指导（仅本次会话，不持久化）
  var GENERATE_WITH_CHARACTER_KEY = 'world_engine_generate_with_character_profile';
  var GENERATE_MODE_KEY = 'world_engine_generate_mode';
  var GENERATE_AUTO_CROP_KEY = 'world_engine_generate_auto_crop';
  var GENERATE_COUNT_MODE_KEY = 'world_engine_generate_count_mode';
  var GENERATE_COUNT_KEY = 'world_engine_generate_count';
  var GENERATE_ENTRY_IDS_KEY = 'world_engine_generate_entry_ids';

  function getGenerateWithCharacter() {
    var store = window.WORLD_ENGINE_STORE;
    var raw = store && store.getItem ? store.getItem(GENERATE_WITH_CHARACTER_KEY) : null;
    return raw == null ? true : raw === 'true';
  }

  function saveGenerateWithCharacter(value) {
    var store = window.WORLD_ENGINE_STORE;
    if (store && store.setItem) store.setItem(GENERATE_WITH_CHARACTER_KEY, value ? 'true' : 'false');
  }

  function getGenerateMode() {
    var store = window.WORLD_ENGINE_STORE;
    var raw = store && store.getItem ? store.getItem(GENERATE_MODE_KEY) : null;
    return raw === 'free' ? 'free' : 'classic';
  }

  function saveGenerateMode(value) {
    var store = window.WORLD_ENGINE_STORE;
    if (store && store.setItem) store.setItem(GENERATE_MODE_KEY, value === 'free' ? 'free' : 'classic');
  }

  function getGenerateAutoCrop() {
    var store = window.WORLD_ENGINE_STORE;
    var raw = store && store.getItem ? store.getItem(GENERATE_AUTO_CROP_KEY) : null;
    return raw === 'true';
  }

  function saveGenerateAutoCrop(value) {
    var store = window.WORLD_ENGINE_STORE;
    if (store && store.setItem) store.setItem(GENERATE_AUTO_CROP_KEY, value ? 'true' : 'false');
  }

  function getGenerateCountMode() {
    var store = window.WORLD_ENGINE_STORE;
    var raw = store && store.getItem ? store.getItem(GENERATE_COUNT_MODE_KEY) : null;
    return raw === 'fixed' ? 'fixed' : 'auto';
  }

  function saveGenerateCountMode(value) {
    var store = window.WORLD_ENGINE_STORE;
    if (store && store.setItem) store.setItem(GENERATE_COUNT_MODE_KEY, value === 'fixed' ? 'fixed' : 'auto');
  }

  function getGenerateCount() {
    var store = window.WORLD_ENGINE_STORE;
    var raw = store && store.getItem ? store.getItem(GENERATE_COUNT_KEY) : null;
    var count = Math.round(Number(raw));
    return Number.isFinite(count) ? Math.max(1, Math.min(12, count)) : 5;
  }

  function saveGenerateCount(value) {
    var store = window.WORLD_ENGINE_STORE;
    var count = Math.round(Number(value));
    if (!Number.isFinite(count)) count = 5;
    count = Math.max(1, Math.min(12, count));
    if (store && store.setItem) store.setItem(GENERATE_COUNT_KEY, String(count));
  }

  function loadGenerateEntryIds() {
    var store = window.WORLD_ENGINE_STORE;
    var raw = store && store.getItem ? store.getItem(GENERATE_ENTRY_IDS_KEY) : null;
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(function (id) { return typeof id === 'string' && id; }) : null;
    } catch (e) {
      return null;
    }
  }

  function saveGenerateEntryIds(ids) {
    var store = window.WORLD_ENGINE_STORE;
    if (store && store.setItem) store.setItem(GENERATE_ENTRY_IDS_KEY, JSON.stringify(Array.isArray(ids) ? ids : []));
  }


  // Collapsible section state (persisted in memory only)
  var _collapsed = {
    rules: true,
    moduleToggles: true,
    schemaOverrides: true,
    termMap: true,
    details: true,
    freeModules: true
  };

  // ─────────────────────────────────────────────
  // CSS Injection
  // ─────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('we-preset-ui-styles')) return;
    var style = document.createElement('style');
    style.id = 'we-preset-ui-styles';
    style.textContent = [
      '/* ── Preset Card ── */',
      '.we-preset-card {',
      '  background: var(--we-bg2, #1e1e2e);',
      '  border: 1px solid var(--we-border, #333);',
      '  border-radius: 6px;',
      '  padding: 10px 12px;',
      '  margin: 8px 0;',
      '}',
      '.we-preset-card-name {',
      '  font-size: 14px;',
      '  font-weight: 600;',
      '  color: var(--we-text1, #eee);',
      '  margin-bottom: 4px;',
      '}',
      '.we-preset-card-desc {',
      '  font-size: 12px;',
      '  color: var(--we-text2, #aaa);',
      '  line-height: 1.5;',
      '}',
      '.we-preset-card-badge {',
      '  display: inline-block;',
      '  font-size: 10px;',
      '  padding: 1px 6px;',
      '  border-radius: 3px;',
      '  margin-left: 6px;',
      '  vertical-align: middle;',
      '}',
      '.we-preset-card-badge.builtin {',
      '  background: var(--we-accent, #6c5ce7);',
      '  color: #fff;',
      '}',
      '.we-preset-card-badge.custom {',
      '  background: var(--we-success, #00b894);',
      '  color: #fff;',
      '}',

      '/* ── Preset Actions Row ── */',
      '.we-preset-actions {',
      '  display: flex;',
      '  flex-wrap: wrap;',
      '  gap: 6px;',
      '  margin-top: 8px;',
      '}',
      '.we-preset-actions .we-btn {',
      '  flex: 0 0 auto;',
      '}',

      '/* ── Generating State ── */',
      '.we-preset-generating {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  padding: 8px 0;',
      '  color: var(--we-text2, #aaa);',
      '  font-size: 12px;',
      '}',
      '.we-preset-generating .we-spinner {',
      '  width: 16px;',
      '  height: 16px;',
      '  border: 2px solid var(--we-border, #333);',
      '  border-top-color: var(--we-accent, #6c5ce7);',
      '  border-radius: 50%;',
      '  animation: we-spin 0.8s linear infinite;',
      '}',
      '.we-generate-config {',
      '  margin-top: 8px;',
      '  padding: 8px;',
      '  border: 1px solid var(--we-border, #333);',
      '  border-radius: 6px;',
      '  background: var(--we-bg, #171722);',
      '}',
      '.we-generate-config-head {',
      '  display: flex;',
      '  justify-content: space-between;',
      '  align-items: center;',
      '  gap: 8px;',
      '  margin-bottom: 6px;',
      '}',
      '.we-generate-config-title {',
      '  font-size: 12px;',
      '  font-weight: 700;',
      '  color: var(--we-text1, #eee);',
      '}',
      '.we-generate-config-summary {',
      '  font-size: 10px;',
      '  color: var(--we-text3, #777);',
      '}',
      '.we-generate-toolbar {',
      '  display: flex;',
      '  flex-wrap: wrap;',
      '  gap: 5px;',
      '  margin: 6px 0;',
      '}',
      '.we-generate-toolbar .we-btn {',
      '  padding: 3px 7px;',
      '  font-size: 11px;',
      '}',
      '.we-generate-mode-row {',
      '  display:flex;',
      '  flex-wrap:wrap;',
      '  gap:10px;',
      '  align-items:center;',
      '  margin:6px 0;',
      '}',
      '.we-generate-entry-list {',
      '  max-height: 260px;',
      '  overflow-y: auto;',
      '  border: 1px solid var(--we-border, #333);',
      '  border-radius: 6px;',
      '  background: var(--we-bg2, #1e1e2e);',
      '}',
      '.we-generate-entry-group + .we-generate-entry-group {',
      '  border-top: 1px solid var(--we-border, #333);',
      '}',
      '.we-generate-entry-group-title {',
      '  padding: 6px 8px;',
      '  background: var(--we-surface, #25253a);',
      '  color: var(--we-text2, #aaa);',
      '  font-size: 11px;',
      '  font-weight: 700;',
      '}',
      '.we-generate-entry {',
      '  display: flex;',
      '  gap: 7px;',
      '  align-items: flex-start;',
      '  padding: 6px 8px;',
      '  cursor: pointer;',
      '}',
      '.we-generate-entry:hover {',
      '  background: var(--we-surface, #25253a);',
      '}',
      '.we-generate-entry input {',
      '  margin-top: 2px;',
      '}',
      '.we-generate-entry strong, .we-generate-entry small {',
      '  display: block;',
      '  overflow-wrap: anywhere;',
      '}',
      '.we-generate-entry strong {',
      '  color: var(--we-text2, #aaa);',
      '  font-size: 11px;',
      '}',
      '.we-generate-entry small {',
      '  margin-top: 2px;',
      '  color: var(--we-text3, #777);',
      '  font-size: 9px;',
      '}',
      '.we-generate-entry.is-disabled {',
      '  opacity: 0.58;',
      '}',
      '.we-generate-footer {',
      '  display: flex;',
      '  justify-content: space-between;',
      '  align-items: center;',
      '  gap: 8px;',
      '  margin-top: 8px;',
      '}',
      '@keyframes we-spin {',
      '  to { transform: rotate(360deg); }',
      '}',

      '/* ── Collapsible Section ── */',
      '.we-collapsible-header {',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: space-between;',
      '  cursor: pointer;',
      '  user-select: none;',
      '  padding: 4px 0;',
      '}',
      '.we-collapsible-header:hover {',
      '  opacity: 0.85;',
      '}',
      '.we-collapsible-arrow {',
      '  font-size: 12px;',
      '  color: var(--we-text3, #666);',
      '  transition: transform 0.2s;',
      '}',
      '.we-collapsible-arrow.open {',
      '  transform: rotate(90deg);',
      '}',
      '.we-collapsible-body {',
      '  overflow: hidden;',
      '  transition: max-height 0.3s ease;',
      '}',
      '.we-collapsible-body.collapsed {',
      '  max-height: 0 !important;',
      '}',

      '/* ── Term Map Table ── */',
      '.we-term-table {',
      '  width: 100%;',
      '  border-collapse: collapse;',
      '  margin: 8px 0;',
      '  font-size: 12px;',
      '}',
      '.we-term-table th {',
      '  text-align: left;',
      '  padding: 6px 8px;',
      '  background: var(--we-bg2, #1e1e2e);',
      '  color: var(--we-text2, #aaa);',
      '  font-weight: 600;',
      '  border-bottom: 1px solid var(--we-border, #333);',
      '}',
      '.we-term-table td {',
      '  padding: 5px 8px;',
      '  border-bottom: 1px solid var(--we-border, #333);',
      '  color: var(--we-text1, #eee);',
      '}',
      '.we-term-table tr:hover td {',
      '  background: var(--we-bg2, #1e1e2e);',
      '}',
      '.we-term-table input {',
      '  width: 100%;',
      '  background: var(--we-bg1, #151520);',
      '  border: 1px solid var(--we-border, #333);',
      '  border-radius: 3px;',
      '  color: var(--we-text1, #eee);',
      '  padding: 3px 6px;',
      '  font-size: 12px;',
      '  box-sizing: border-box;',
      '}',
      '.we-term-table .we-term-delete-btn {',
      '  cursor: pointer;',
      '  color: var(--we-danger, #ff6b6b);',
      '  font-size: 14px;',
      '  padding: 0 4px;',
      '  opacity: 0.7;',
      '}',
      '.we-term-table .we-term-delete-btn:hover {',
      '  opacity: 1;',
      '}',

      '/* ── Preset Detail Sub-sections ── */',
      '.we-detail-subsection {',
      '  margin: 10px 0;',
      '  padding: 8px 10px;',
      '  background: var(--we-bg2, #1e1e2e);',
      '  border-radius: 5px;',
      '  border: 1px solid var(--we-border, #333);',
      '}',
      '.we-detail-subsection-title {',
      '  font-size: 13px;',
      '  font-weight: 600;',
      '  color: var(--we-text1, #eee);',
      '  margin-bottom: 8px;',
      '  padding-bottom: 4px;',
      '  border-bottom: 1px solid var(--we-border, #333);',
      '}',
      '.we-detail-field {',
      '  margin: 6px 0;',
      '}',
      '.we-detail-field label {',
      '  display: block;',
      '  font-size: 11px;',
      '  color: var(--we-text3, #666);',
      '  margin-bottom: 2px;',
      '}',
      '.we-detail-field input,',
      '.we-detail-field textarea {',
      '  width: 100%;',
      '  background: var(--we-bg1, #151520);',
      '  border: 1px solid var(--we-border, #333);',
      '  border-radius: 3px;',
      '  color: var(--we-text1, #eee);',
      '  padding: 4px 8px;',
      '  font-size: 12px;',
      '  box-sizing: border-box;',
      '}',
      '.we-detail-field textarea {',
      '  resize: vertical;',
      '  min-height: 60px;',
      '}',
      '.we-detail-item-row {',
      '  display: flex;',
      '  gap: 6px;',
      '  align-items: center;',
      '  margin: 4px 0;',
      '}',
      '.we-detail-item-row input {',
      '  flex: 1;',
      '  background: var(--we-bg1, #151520);',
      '  border: 1px solid var(--we-border, #333);',
      '  border-radius: 3px;',
      '  color: var(--we-text1, #eee);',
      '  padding: 3px 6px;',
      '  font-size: 12px;',
      '}',
      '.we-detail-item-delete {',
      '  cursor: pointer;',
      '  color: var(--we-danger, #ff6b6b);',
      '  font-size: 14px;',
      '  opacity: 0.7;',
      '  flex-shrink: 0;',
      '}',
      '.we-detail-item-delete:hover {',
      '  opacity: 1;',
      '}',

      '/* ── Incident Editor ── */',
      '.we-incident-card {',
      '  background: var(--we-bg1, #151520);',
      '  border: 1px solid var(--we-border, #333);',
      '  border-radius: 4px;',
      '  padding: 8px 10px;',
      '  margin: 6px 0;',
      '}',
      '.we-incident-card-header {',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: space-between;',
      '  margin-bottom: 6px;',
      '}',
      '.we-incident-card-header span {',
      '  font-size: 12px;',
      '  font-weight: 600;',
      '  color: var(--we-text1, #eee);',
      '}',

      '.we-mode-row, .we-free-toolbar {',
      '  display:flex;',
      '  flex-wrap:wrap;',
      '  gap:8px;',
      '  align-items:center;',
      '  margin:8px 0;',
      '}',
      '.we-free-module-card {',
      '  border:1px solid var(--we-border,#333);',
      '  border-radius:6px;',
      '  padding:8px;',
      '  margin:8px 0;',
      '  background:var(--we-bg2,#1e1e2e);',
      '}',
      '.we-free-module-head {',
      '  display:grid;',
      '  grid-template-columns:auto 110px minmax(120px,1fr) 70px 32px 32px 32px;',
      '  gap:6px;',
      '  align-items:center;',
      '  margin-bottom:8px;',
      '}',
      '.we-free-module-grid {',
      '  display:grid;',
      '  grid-template-columns:repeat(auto-fit,minmax(140px,1fr));',
      '  gap:6px;',
      '  margin:6px 0;',
      '}',
      '.we-free-module-grid label, .we-free-block-label {',
      '  display:block;',
      '  font-size:11px;',
      '  color:var(--we-text3,#777);',
      '}',
      '.we-free-module-grid input, .we-free-module-grid select, .we-free-module-head input, .we-free-module-head select, #we-free-builtin-select {',
      '  width:100%;',
      '  background:var(--we-bg1,#151520);',
      '  border:1px solid var(--we-border,#333);',
      '  border-radius:3px;',
      '  color:var(--we-text1,#eee);',
      '  padding:4px 6px;',
      '  box-sizing:border-box;',
      '}',
      '.we-free-block-label textarea, .we-free-mech-json {',
      '  width:100%;',
      '  min-height:70px;',
      '  background:var(--we-bg1,#151520);',
      '  border:1px solid var(--we-border,#333);',
      '  border-radius:3px;',
      '  color:var(--we-text1,#eee);',
      '  padding:6px;',
      '  box-sizing:border-box;',
      '  font-family:var(--mono-font,monospace);',
      '  font-size:11px;',
      '}',
      '.we-free-subtitle {',
      '  margin:8px 0 4px;',
      '  font-size:12px;',
      '  font-weight:700;',
      '  color:var(--we-text2,#aaa);',
      '}',
      '.we-free-mechanics-toolbar {',
      '  display:flex;',
      '  flex-wrap:wrap;',
      '  gap:6px;',
      '  align-items:center;',
      '  margin:4px 0;',
      '}',
      '/* ── Separator ── */',
      '.we-preset-separator {',
      '  border: none;',
      '  border-top: 1px dashed var(--we-border, #333);',
      '  margin: 12px 0;',
      '}',

      '/* ── Hidden file input ── */',
      '#we-preset-file-input {',
      '  display: none;',
      '}',

      '/* ── Confirmation dialog ── */',
      '.we-confirm-overlay {',
      '  position: fixed;',
      '  top: 0; left: 0; right: 0; bottom: 0;',
      '  height: 100vh; height: 100dvh;',  /* dvh 适配手机动态视口；vh 作为旧内核回退 */
      '  background: rgba(0,0,0,0.6);',
      '  z-index: 100002;',
      '  display: flex;',
      '  flex-direction: column;',  /* 配合 margin:auto：空间够则垂直居中，不够则顶部贴可滚动区、能下滚 */
      '  align-items: center;',
      '  justify-content: flex-start;',
      '  overflow-y: auto;',  /* 框比屏幕高时可滚动看到全部，避免 flex 顶部裁切 */
      '  -webkit-overflow-scrolling: touch;',
      '  overscroll-behavior: contain;',
      '  padding: 16px;',
      '  box-sizing: border-box;',
      '}',
      '.we-confirm-box {',
      '  background: var(--we-bg1, #151520);',
      '  border: 1px solid var(--we-border, #333);',
      '  border-radius: 8px;',
      '  padding: 20px 24px;',
      '  max-width: 360px;',
      '  margin: auto;',  /* 在 column flex 中实现「可居中、又不会把顶部推出屏幕」 */
      '  text-align: center;',
      '  color: var(--we-text1, #eee);',
      '}',
      '.we-confirm-box p {',
      '  margin: 0 0 16px;',
      '  font-size: 14px;',
      '  line-height: 1.6;',
      '}',
      '.we-confirm-box .we-confirm-actions {',
      '  display: flex;',
      '  gap: 10px;',
      '  justify-content: center;',
      '}',
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────
  function esc(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function getPresets() {
    return window.WORLD_ENGINE_PRESETS || null;
  }

  function toast(msg) {
    // Use SillyTavern's toastr if available, otherwise console
    if (window.toastr && typeof window.toastr.success === 'function') {
      window.toastr.success(msg);
    } else {
      console.log('[WorldEngine PresetUI] ' + msg);
    }
  }

  function toastError(msg) {
    if (window.toastr && typeof window.toastr.error === 'function') {
      window.toastr.error(msg);
    } else {
      console.error('[WorldEngine PresetUI] ' + msg);
    }
  }

  function toastWarning(msg) {
    if (window.toastr && typeof window.toastr.warning === 'function') {
      window.toastr.warning(msg);
    } else {
      console.warn('[WorldEngine PresetUI] ' + msg);
    }
  }

  function groupEntriesByWorld(entries) {
    var groups = {};
    (entries || []).forEach(function (entry) {
      var world = entry.world || '未知世界书';
      if (!groups[world]) groups[world] = [];
      groups[world].push(entry);
    });
    return groups;
  }

  function getBackendWorldbookSelectedIds() {
    var WB = window.WORLD_ENGINE_WORLDBOOK;
    if (!WB || typeof WB.getSelectedIds !== 'function') return [];
    var ids = WB.getSelectedIds();
    return Array.isArray(ids) ? ids : [];
  }

  function hasBackendWorldbookSelection() {
    var WB = window.WORLD_ENGINE_WORLDBOOK;
    return !!(WB && typeof WB.hasSelection === 'function' && WB.hasSelection());
  }

  function getEnabledGenerateEntryIds() {
    return (_generateEntries || []).filter(function (entry) { return !entry.disabled; }).map(function (entry) { return entry.id; });
  }

  function getGenerateSelectedSet() {
    if (!_generateSelectedIds) {
      var backendIds = getBackendWorldbookSelectedIds();
      var savedIds = loadGenerateEntryIds();
      _generateSelectedIds = hasBackendWorldbookSelection() ? backendIds.slice() : (savedIds || getEnabledGenerateEntryIds());
    }
    return new Set(_generateSelectedIds || []);
  }

  function readGenerateSelectedIdsFromDOM() {
    var boxes = document.querySelectorAll('.we-generate-entry-cb');
    var ids = [];
    for (var i = 0; i < boxes.length; i++) {
      if (boxes[i].checked && !boxes[i].disabled) ids.push(boxes[i].getAttribute('data-entry-id'));
    }
    _generateSelectedIds = ids;
    saveGenerateEntryIds(ids);
    return ids;
  }

  async function loadGenerateEntries(syncBackend) {
    var WB = window.WORLD_ENGINE_WORLDBOOK;
    if (!WB || typeof WB.loadCurrentEntries !== 'function') {
      _generateEntries = [];
      _generateEntriesError = '世界书读取接口不可用';
      return;
    }
    _generateEntriesLoading = true;
    _generateEntriesError = '';
    refreshPresetSection();
    try {
      var entries = await WB.loadCurrentEntries();
      _generateEntries = Array.isArray(entries) ? entries : [];
      if (syncBackend || !_generateSelectedIds) {
        var backendIds = getBackendWorldbookSelectedIds();
        var savedIds = loadGenerateEntryIds();
        _generateSelectedIds = hasBackendWorldbookSelection() ? backendIds.slice() : (savedIds || getEnabledGenerateEntryIds());
        saveGenerateEntryIds(_generateSelectedIds);
      } else {
        var available = new Set(_generateEntries.map(function (entry) { return entry.id; }));
        _generateSelectedIds = (_generateSelectedIds || []).filter(function (id) { return available.has(id); });
      }
    } catch (err) {
      _generateEntries = [];
      _generateEntriesError = err && err.message ? err.message : String(err || '读取失败');
    } finally {
      _generateEntriesLoading = false;
      refreshPresetSection();
    }
  }

  /**
   * Show a confirmation dialog. Returns a promise that resolves true/false.
   */
  function showConfirm(message) {
    return new Promise(function (resolve) {
      // 弹出前收起软键盘，避免手机上「键盘顶起视口」导致弹窗错位/看不见
      try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
      var overlay = document.createElement('div');
      overlay.className = 'we-confirm-overlay';
      overlay.innerHTML =
        '<div class="we-confirm-box">' +
          '<p>' + esc(message) + '</p>' +
          '<div class="we-confirm-actions">' +
            '<button class="we-btn we-btn-danger" data-we-confirm="yes">确认</button>' +
            '<button class="we-btn" data-we-confirm="no">取消</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);

      function cleanup(result) {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        resolve(result);
      }

      overlay.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-we-confirm]');
        if (btn) {
          cleanup(btn.getAttribute('data-we-confirm') === 'yes');
        } else if (e.target === overlay) {
          cleanup(false);
        }
      });
    });
  }

  /**
   * Deep clone via JSON round-trip.
   */
  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Generate a unique ID for custom presets.
   */
  function generateId() {
    return 'custom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  }

  function buildGenerateConfigHTML(includeCharacter) {
    if (!_generateMenuOpen) return '';

    var selectedSet = getGenerateSelectedSet();
    var enabledEntries = (_generateEntries || []).filter(function (entry) { return !entry.disabled; });
    var selectedCount = enabledEntries.filter(function (entry) { return selectedSet.has(entry.id); }).length;
    var summary = _generateEntriesLoading
      ? '读取世界书条目中'
      : ('已选 ' + selectedCount + ' / ' + enabledEntries.length + ' 个可用条目');
    var generationMode = getGenerateMode();
    var autoCropModules = getGenerateAutoCrop();
    var moduleCountMode = getGenerateCountMode();
    var moduleCount = getGenerateCount();

    var listHtml = '';
    if (_generateEntriesLoading) {
      listHtml = '<div class="we-preset-generating"><div class="we-spinner"></div>正在读取世界书条目...</div>';
    } else if (_generateEntriesError) {
      listHtml = '<div class="we-empty">' + esc(_generateEntriesError) + '</div>';
    } else if (!_generateEntries.length) {
      listHtml = '<div class="we-empty">未读取到世界书条目</div>';
    } else {
      var groups = groupEntriesByWorld(_generateEntries);
      Object.keys(groups).sort().forEach(function (world) {
        var entries = groups[world];
        listHtml += '<div class="we-generate-entry-group">' +
          '<div class="we-generate-entry-group-title">' + esc(world) + ' <span>(' + entries.length + ')</span></div>';
        entries.forEach(function (entry) {
          var checked = !entry.disabled && selectedSet.has(entry.id) ? ' checked' : '';
          var disabled = entry.disabled ? ' disabled' : '';
          var cls = entry.disabled ? ' we-generate-entry is-disabled' : ' we-generate-entry';
          var preview = String(entry.content || '').replace(/\s+/g, ' ').trim();
          if (preview.length > 90) preview = preview.substring(0, 90) + '...';
          listHtml += '<label class="' + cls + '">' +
            '<input class="we-generate-entry-cb" type="checkbox" data-entry-id="' + esc(entry.id) + '"' + checked + disabled + '>' +
            '<span><strong>' + esc(entry.title || entry.id) + '</strong>' +
            '<small>' + esc(entry.disabled ? '已关闭，不会参与生成' : preview) + '</small></span>' +
          '</label>';
        });
        listHtml += '</div>';
      });
      listHtml = '<div class="we-generate-entry-list">' + listHtml + '</div>';
    }

    return '' +
      '<div class="we-generate-config">' +
        '<div class="we-generate-config-head">' +
          '<div>' +
            '<div class="we-generate-config-title">生成设置</div>' +
            '<div class="we-generate-config-summary">' + esc(summary) + '</div>' +
          '</div>' +
          '<button class="we-btn" id="we-preset-generate-close">收起</button>' +
        '</div>' +
        '<div class="we-generate-toolbar">' +
          '<button class="we-btn" data-we-generate-sync>同步后台选择</button>' +
          '<button class="we-btn" data-we-generate-select-all>全选可用</button>' +
          '<button class="we-btn" data-we-generate-clear>清空</button>' +
          '<button class="we-btn" data-we-generate-refresh>刷新条目</button>' +
        '</div>' +
        '<div class="we-generate-mode-row">' +
          '<label class="we-hint" style="display:flex;align-items:center;gap:6px;margin:0;"><input type="radio" name="we-preset-generate-mode" value="classic"' + (generationMode === 'classic' ? ' checked' : '') + '> 十二模块生成</label>' +
          '<label class="we-hint" style="display:flex;align-items:center;gap:6px;margin:0;"><input type="radio" name="we-preset-generate-mode" value="free"' + (generationMode === 'free' ? ' checked' : '') + '> 自由生成</label>' +
        '</div>' +
        '<div class="we-generate-mode-row">' +
          '<label class="we-hint" style="display:flex;align-items:center;gap:6px;margin:0;"><input type="checkbox" id="we-preset-generate-auto-crop"' + (autoCropModules ? ' checked' : '') + '> AI 自动裁剪</label>' +
          '<label class="we-hint" style="display:flex;align-items:center;gap:6px;margin:0;">模块数量 <select id="we-preset-generate-count-mode"><option value="auto"' + (moduleCountMode === 'auto' ? ' selected' : '') + '>委任 AI 决定</option><option value="fixed"' + (moduleCountMode === 'fixed' ? ' selected' : '') + '>用户指定</option></select></label>' +
          '<input id="we-preset-generate-count" type="number" min="1" max="12" value="' + esc(moduleCount) + '" title="模块数量" style="width:58px;">' +
        '</div>' +
        listHtml +
        '<div class="we-generate-mode-row" style="flex-direction:column;align-items:stretch;gap:4px;">' +
          '<label class="we-hint" style="margin:0;">生成指导（可留空）</label>' +
          '<textarea id="we-preset-generate-guidance" rows="2" placeholder="用一句话引导 AI，例如：突出宫廷权谋、淡化战斗；或 这是赛博朋克世界，重点追踪义体与企业势力" style="width:100%;resize:vertical;">' + esc(_generateGuidance || '') + '</textarea>' +
        '</div>' +
        '<div class="we-generate-footer">' +
          '<label class="we-hint" style="display:flex;align-items:center;gap:6px;margin:0;"><input type="checkbox" id="we-preset-generate-character"' + (includeCharacter ? ' checked' : '') + '> 同时读取当前角色卡描述</label>' +
          '<button class="we-btn we-btn-primary" id="we-preset-generate-start"' + (_generating || _generateEntriesLoading ? ' disabled' : '') + '>开始生成</button>' +
        '</div>' +
      '</div>';
  }

  // ─────────────────────────────────────────────
  // Section 1: 世界观预设 (Preset Selector)
  // ─────────────────────────────────────────────
  // 当前预设是否显示稳定度仪表：手动覆盖（store）优先，其次预设自带 showStability。
  function isStabilityShownForPreset(preset) {
    if (!preset) return true;
    try {
      var store = window.WORLD_ENGINE_STORE;
      var ov = store && store.getItem ? store.getItem('world_engine_show_stability_' + preset.id) : null;
      if (ov === 'true') return true;
      if (ov === 'false') return false;
    } catch (e) {}
    return preset.showStability !== false;
  }

  function buildPresetSelectorHTML() {
    var P = getPresets();
    if (!P) return '<div class="we-empty">预设系统未加载</div>';

    var allPresets = P.getAllPresets();
    var activeId = P.getActivePresetId();
    var activePreset = P.getActivePreset();

    var optionsHtml = '';
    for (var i = 0; i < allPresets.length; i++) {
      var p = allPresets[i];
      var sel = (p.id === activeId) ? ' selected' : '';
      var tag = p.builtin ? ' [内置]' : ' [自定义]';
      optionsHtml += '<option value="' + esc(p.id) + '"' + sel + '>' + esc(p.name) + tag + '</option>';
    }

    var badgeClass = activePreset.builtin ? 'builtin' : 'custom';
    var badgeText = activePreset.builtin ? '内置预设' : '自定义预设';
    var includeCharacter = getGenerateWithCharacter();
    var showStability = isStabilityShownForPreset(activePreset);

    return '' +
      '<div class="we-section">' +
        '<div class="we-section-title">世界观预设</div>' +
        '<div class="we-input-group">' +
          '<label>选择预设</label>' +
          '<select id="we-preset-selector">' + optionsHtml + '</select>' +
        '</div>' +
        '<div class="we-preset-card">' +
          '<div class="we-preset-card-name">' +
            esc(activePreset.name) +
            '<span class="we-preset-card-badge ' + badgeClass + '">' + badgeText + '</span>' +
          '</div>' +
          '<div class="we-preset-card-desc">' + esc(activePreset.description) + '</div>' +
        '</div>' +
        '<label class="we-hint" style="display:flex;align-items:center;gap:6px;margin:6px 0 0;cursor:pointer;"><input type="checkbox" id="we-preset-show-stability"' + (showStability ? ' checked' : '') + '> 显示世界稳定度仪表（恋爱 / 日常类世界可关闭）</label>' +
        '<div class="we-preset-actions">' +
          '<button class="we-btn we-btn-primary" id="we-preset-apply">应用</button>' +
          '<button class="we-btn" id="we-preset-generate"' + (_generating ? ' disabled' : '') + '>' + (_generateMenuOpen ? '收起生成设置' : '从设定生成') + '</button>' +
          '<button class="we-btn" id="we-preset-import">导入预设</button>' +
          '<button class="we-btn" id="we-preset-export">导出当前预设</button>' +
          (activePreset.builtin ? '' : '<button class="we-btn we-btn-danger" id="we-preset-delete">删除当前预设</button>') +
        '</div>' +
        buildGenerateConfigHTML(includeCharacter) +
        (_generating
          ? '<div class="we-preset-generating"><div class="we-spinner"></div>正在从世界书和角色卡生成预设，请稍候...</div>'
          : '') +
        '<input type="file" id="we-preset-file-input" accept=".json">' +
      '</div>';
  }

  function isStrictIdentifier(value) {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value || '');
  }

  function ensureCustomPresetForEdit(preset, reason) {
    var P = getPresets();
    if (!P || !preset) return null;
    if (!preset.builtin) return preset;
    var copy = deepClone(preset);
    copy.id = generateId();
    copy.name = preset.name + ' (自定义)';
    copy.builtin = false;
    P.saveCustomPreset(copy);
    P.setActivePreset(copy.id);
    toast(reason || ('已创建自定义副本: ' + copy.name));
    return P.getActivePreset();
  }

  function cloneBuiltinModuleRef(moduleId, order) {
    return { id: moduleId, kind: 'builtin', enabled: true, order: Number.isFinite(Number(order)) ? Number(order) : 1 };
  }

  function seedFreeModulesFromClassic(preset) {
    var rulesLoader = window.WORLD_ENGINE_RULES;
    var modules = rulesLoader && rulesLoader.getModuleList ? rulesLoader.getModuleList() : [];
    var disabled = Array.isArray(preset && preset.disabledModules) ? preset.disabledModules : [];
    var result = [];
    for (var i = 0; i < modules.length; i++) {
      if (disabled.indexOf(modules[i].moduleId) === -1) result.push(cloneBuiltinModuleRef(modules[i].moduleId, i + 1));
    }
    return result;
  }

  function getBuiltinModuleOptions(selectedId) {
    var rulesLoader = window.WORLD_ENGINE_RULES;
    var modules = rulesLoader && rulesLoader.getModuleList ? rulesLoader.getModuleList() : [];
    var html = '';
    for (var i = 0; i < modules.length; i++) {
      html += '<option value="' + esc(modules[i].moduleId) + '"' + (modules[i].moduleId === selectedId ? ' selected' : '') + '>' + esc(modules[i].comment || modules[i].moduleId) + '</option>';
    }
    return html;
  }

  function buildFreeModuleFieldRows(fields) {
    fields = fields || {};
    var rows = '';
    Object.keys(fields).forEach(function (field) {
      rows += buildNewSchemaRowHTML('', field, fields[field] || {});
    });
    rows += buildNewSchemaRowHTML('', '', {});
    return rows;
  }

  function stringifyConfig(value) {
    if (!value || (typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length)) return '';
    try { return JSON.stringify(value, null, 2); } catch (e) { return ''; }
  }

  function buildFreeModuleCardHTML(module, index) {
    module = module || {};
    var kind = module.kind === 'builtin' ? 'builtin' : 'custom';
    var container = module.container || (kind === 'builtin' ? 'none' : 'array');
    var enabled = module.enabled !== false;
    var mechanics = module.mechanics || {};
    var display = module.display || {};
    var fields = module.fields || {};
    var header = kind === 'builtin'
      ? '<select class="we-free-module-builtin-id">' + getBuiltinModuleOptions(module.id) + '</select>'
      : '<input class="we-free-module-id" type="text" value="' + esc(module.id || '') + '" placeholder="moduleId">';
    var customBody = kind === 'custom' ?
      '<div class="we-free-module-grid">' +
        '<label>名称<input class="we-free-module-name" type="text" value="' + esc(module.name || '') + '"></label>' +
        '<label>字段<input class="we-free-module-field" type="text" value="' + esc(module.field || module.id || '') + '"></label>' +
        '<label>容器<select class="we-free-module-container">' + ['array','object','scalar','none'].map(function (c) { return '<option value="' + c + '"' + (c === container ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></label>' +
        '<label>数组键<input class="we-free-module-item-key" type="text" value="' + esc(module.itemKey || 'name') + '"></label>' +
      '</div>' +
      '<label class="we-free-block-label">规则<textarea class="we-free-module-rules" spellcheck="false">' + esc(module.rules || '') + '</textarea></label>' +
      '<div class="we-free-subtitle">字段</div>' +
      '<div class="we-free-module-fields">' + buildFreeModuleFieldRows(fields) + '</div>' +
      '<button class="we-btn we-free-add-field" type="button">新增字段</button>' +
      '<div class="we-free-subtitle">显示</div>' +
      '<div class="we-free-module-grid">' +
        '<label>样式<select class="we-free-display-style">' + ['cards','table','keyvalue','list'].map(function (s) { return '<option value="' + s + '"' + (s === (display.style || 'cards') ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></label>' +
        '<label>标题字段<input class="we-free-display-title" type="text" value="' + esc(display.titleField || '') + '"></label>' +
        '<label>徽标字段<input class="we-free-display-badges" type="text" value="' + esc((display.badgeFields || []).join(', ')) + '"></label>' +
        '<label>正文字段<input class="we-free-display-body" type="text" value="' + esc((display.bodyFields || display.fields || []).join(', ')) + '"></label>' +
        '<label>空状态<input class="we-free-display-empty" type="text" value="' + esc(display.emptyText || '') + '"></label>' +
      '</div>' +
      '<div class="we-free-subtitle">机制</div>' +
      '<div class="we-free-mechanics-toolbar">' +
        '<label><input class="we-free-mech-enabled" data-mech="dice" type="checkbox"' + (mechanics.dice ? ' checked' : '') + '> dice</label>' +
        '<button class="we-btn" type="button" data-we-mech-template="dice">模板</button>' +
        '<label><input class="we-free-mech-enabled" data-mech="stages" type="checkbox"' + (mechanics.stages ? ' checked' : '') + '> stages</label>' +
        '<button class="we-btn" type="button" data-we-mech-template="stages">模板</button>' +
        '<label><input class="we-free-mech-enabled" data-mech="verdicts" type="checkbox"' + (mechanics.verdicts ? ' checked' : '') + '> verdicts</label>' +
        '<button class="we-btn" type="button" data-we-mech-template="verdicts">模板</button>' +
      '</div>' +
      '<textarea class="we-free-mech-json" data-mech="dice" placeholder="dice JSON">' + esc(stringifyConfig(mechanics.dice)) + '</textarea>' +
      '<textarea class="we-free-mech-json" data-mech="stages" placeholder="stages JSON">' + esc(stringifyConfig(mechanics.stages)) + '</textarea>' +
      '<textarea class="we-free-mech-json" data-mech="verdicts" placeholder="verdicts JSON">' + esc(stringifyConfig(mechanics.verdicts)) + '</textarea>'
      : '<div class="we-hint">内置模块会复用原规则、schema、机制和专属渲染。</div>';
    return '' +
      '<div class="we-free-module-card" data-free-module-index="' + index + '" data-free-kind="' + kind + '">' +
        '<div class="we-free-module-head">' +
          '<label class="we-free-enabled"><input class="we-free-module-enabled" type="checkbox"' + (enabled ? ' checked' : '') + '>启用</label>' +
          '<select class="we-free-module-kind"><option value="custom"' + (kind === 'custom' ? ' selected' : '') + '>自定义</option><option value="builtin"' + (kind === 'builtin' ? ' selected' : '') + '>内置引用</option></select>' +
          header +
          '<input class="we-free-module-order" type="number" value="' + esc(module.order == null ? (index + 1) : module.order) + '" title="排序">' +
          '<button class="we-icon-btn we-free-module-up" type="button" title="上移"><i class="fa-solid fa-arrow-up"></i></button>' +
          '<button class="we-icon-btn we-free-module-down" type="button" title="下移"><i class="fa-solid fa-arrow-down"></i></button>' +
          '<button class="we-icon-btn we-free-module-delete" type="button" title="删除"><i class="fa-solid fa-trash-can"></i></button>' +
        '</div>' +
        customBody +
      '</div>';
  }

  function buildModeModulesHTML() {
    var P = getPresets();
    if (!P) return '';
    var preset = P.getActivePreset();
    var mode = preset.mode === 'free' ? 'free' : 'classic';
    var isBuiltin = preset.builtin;
    var arrowClass = _collapsed.freeModules ? '' : ' open';
    var bodyClass = _collapsed.freeModules ? ' collapsed' : '';
    var modules = Array.isArray(preset.modules) ? preset.modules : [];
    var rows = modules.length ? modules.map(buildFreeModuleCardHTML).join('') : '<div class="we-empty">暂无自由模块</div>';
    return '' +
      '<hr class="we-preset-separator">' +
      '<div class="we-section">' +
        '<div class="we-collapsible-header" data-we-toggle="freeModules">' +
          '<span class="we-section-title" style="margin:0;">模式与自由模块</span>' +
          '<span class="we-collapsible-arrow' + arrowClass + '">&#9654;</span>' +
        '</div>' +
        '<div class="we-collapsible-body' + bodyClass + '" data-we-body="freeModules" style="max-height:1600px;">' +
          (isBuiltin ? '<div class="we-hint" style="margin-bottom:6px;color:var(--we-warning,#fdcb6e);">当前为内置预设，保存模式或模块时会自动创建自定义副本。</div>' : '') +
          '<div class="we-mode-row">' +
            '<label><input type="radio" name="we-preset-mode" value="classic"' + (mode === 'classic' ? ' checked' : '') + '> classic</label>' +
            '<label><input type="radio" name="we-preset-mode" value="free"' + (mode === 'free' ? ' checked' : '') + '> free</label>' +
            '<button class="we-btn we-btn-primary" id="we-preset-save-mode" type="button">保存模式</button>' +
          '</div>' +
          (mode === 'classic' ? '<div class="we-hint">classic 模式使用内置十二模块；下方模块开关仍可控制启用项。</div>' :
            '<div class="we-free-toolbar">' +
              '<button class="we-btn" id="we-free-add-custom" type="button">新增自定义模块</button>' +
              '<select id="we-free-builtin-select">' + getBuiltinModuleOptions('events') + '</select>' +
              '<button class="we-btn" id="we-free-add-builtin" type="button">从内置引入</button>' +
              '<button class="we-btn we-btn-primary" id="we-free-save-modules" type="button">保存自由模块</button>' +
            '</div>' +
            '<div id="we-free-modules-list">' + rows + '</div>') +
        '</div>' +
      '</div>';
  }
  // ─────────────────────────────────────────────
  // Section 2: 规则编辑器 (Rules Editor)
  // ─────────────────────────────────────────────
  function buildRulesEditorHTML() {
    var P = getPresets();
    if (!P) return '';

    var preset = P.getActivePreset();
    var isBuiltin = preset.builtin;
    var arrowClass = _collapsed.rules ? '' : ' open';
    var bodyClass = _collapsed.rules ? ' collapsed' : '';

    var builtinNote = isBuiltin
      ? '<div class="we-hint" style="margin-bottom:6px;color:var(--we-warning,#fdcb6e);">当前为内置预设。保存自定义规则时将自动创建一个副本。</div>'
      : '';

    return '' +
      '<hr class="we-preset-separator">' +
      '<div class="we-section">' +
        '<div class="we-collapsible-header" data-we-toggle="rules">' +
          '<span class="we-section-title" style="margin:0;">规则编辑器</span>' +
          '<span class="we-collapsible-arrow' + arrowClass + '">&#9654;</span>' +
        '</div>' +
        '<div class="we-collapsible-body' + bodyClass + '" data-we-body="rules" style="max-height:800px;">' +
          builtinNote +
          '<div class="we-hint" style="margin-bottom:6px;">自定义规则将追加到内置演绎规则之后，用于补充或覆盖默认行为。</div>' +
          '<div class="we-input-group">' +
            '<label>自定义规则</label>' +
            '<textarea id="we-preset-custom-rules" style="min-height:200px;" placeholder="在此输入自定义演绎规则...">' + esc(preset.customRules || '') + '</textarea>' +
          '</div>' +
          '<button class="we-btn we-btn-primary" id="we-preset-save-rules" style="margin-top:6px;">保存自定义规则</button>' +
        '</div>' +
      '</div>';
  }

  // ─────────────────────────────────────────────
  // Section 3: 术语表预览 (Term Map Preview)
  // ─────────────────────────────────────────────
  function buildModuleTogglesHTML() {
    var P = getPresets();
    if (!P) return '';
    var rulesLoader = window.WORLD_ENGINE_RULES;
    if (!rulesLoader || !rulesLoader.getModuleList) return '';

    var preset = P.getActivePreset();
    var isBuiltin = preset.builtin;
    var modules = rulesLoader.getModuleList();
    var disabled = Array.isArray(preset.disabledModules) ? preset.disabledModules : [];
    var arrowClass = _collapsed.moduleToggles ? '' : ' open';
    var bodyClass = _collapsed.moduleToggles ? ' collapsed' : '';
    var builtinNote = isBuiltin
      ? '<div class="we-hint" style="margin-bottom:6px;color:var(--we-warning,#fdcb6e);">当前为内置预设，保存后会自动创建自定义副本。</div>'
      : '';

    // 把内置模块名（"模块X：原始词"）替换成当前世界预设的对应叫法。
    // 优先级：预设显式 ui.moduleLabels[moduleId] > 用 ui.labels 主题化后缀词 > 默认 comment。
    // 后缀别名表：模块名后缀与 ui.labels 的 key 不完全一致时在此映射。
    var MODULE_LABEL_ALIAS = {
      '世界运转': '世界核心',
      '区域突发事件': '区域事件',
      '信息黑盒': '秘密'
    };
    function resolveModuleLabel(m) {
      var base = m.comment || m.moduleId;
      var explicit = P.uiModuleLabel ? P.uiModuleLabel(m.moduleId) : '';
      if (explicit) return explicit;
      var parts = String(base).split('：');
      if (parts.length === 2 && P.uiLabel) {
        var key = MODULE_LABEL_ALIAS[parts[1]] || parts[1];
        var themed = P.uiLabel(key);
        if (themed && themed !== key) return parts[0] + '：' + themed;
      }
      return base;
    }

    var rows = '';
    for (var i = 0; i < modules.length; i++) {
      var m = modules[i];
      var checked = disabled.indexOf(m.moduleId) === -1;
      var label = resolveModuleLabel(m);
      rows +=
        '<label class="we-module-toggle-row" style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;">' +
          '<input type="checkbox" class="we-module-toggle-cb" data-module-id="' + esc(m.moduleId) + '"' + (checked ? ' checked' : '') + '>' +
          '<span style="' + (checked ? '' : 'opacity:0.5;text-decoration:line-through;') + '">' + esc(label) + '</span>' +
        '</label>';
    }

    return '' +
      '<hr class="we-preset-separator">' +
      '<div class="we-section">' +
        '<div class="we-collapsible-header" data-we-toggle="moduleToggles">' +
          '<span class="we-section-title" style="margin:0;">模块开关</span>' +
          '<span class="we-collapsible-arrow' + arrowClass + '">&#9654;</span>' +
        '</div>' +
        '<div class="we-collapsible-body' + bodyClass + '" data-we-body="moduleToggles">' +
          builtinNote +
          '<div class="we-hint" style="margin-bottom:6px;">关闭模块后，该模块的规则和输出字段都会从推演中移除。</div>' +
          '<div id="we-module-toggles-list" style="margin-bottom:8px;">' + rows + '</div>' +
          '<button class="we-btn we-btn-primary" id="we-preset-save-modules" style="margin-top:6px;">保存模块设置</button>' +
        '</div>' +
      '</div>';
  }

  // ===== 结构编辑器辅助（字段类型下拉 / 行渲染 / 校验 / 预览） =====
  var SCHEMA_GRID_STYLE = 'display:grid;grid-template-columns:1fr 96px 1.4fr 1fr 1fr 48px 48px 64px;gap:6px;align-items:center;';
  var SCHEMA_TYPE_OPTIONS = [
    ['string', '文本'], ['number', '数字'], ['boolean', '布尔'], ['enum', '枚举'],
    ['array<string>', '文本数组'], ['object', '对象'], ['array<object>', '对象数组']
  ];

  function schemaTypeSelectHTML(currentType) {
    var t = String(currentType || 'string');
    var known = SCHEMA_TYPE_OPTIONS.some(function (o) { return o[0] === t; });
    var html = '<select class="we-schema-field-type">';
    SCHEMA_TYPE_OPTIONS.forEach(function (o) {
      html += '<option value="' + esc(o[0]) + '"' + (o[0] === t ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    });
    if (!known && t) html += '<option value="' + esc(t) + '" selected>' + esc(t) + '（自定义）</option>';
    html += '</select>';
    return html;
  }

  function setSelectValue(sel, val) {
    if (!sel) return;
    val = String(val == null ? '' : val);
    var found = false;
    for (var i = 0; i < sel.options.length; i++) { if (sel.options[i].value === val) { found = true; break; } }
    if (!found && val) {
      var o = document.createElement('option');
      o.value = val; o.textContent = val + '（自定义）';
      sel.appendChild(o);
    }
    sel.value = val;
  }

  function buildExistingSchemaRowHTML(moduleId, field, spec, hidden) {
    var enumText = Array.isArray(spec.enum) ? spec.enum.join(', ') : '';
    var exampleText = spec.example === undefined ? '' : JSON.stringify(spec.example);
    return '' +
      '<div class="we-schema-row" data-schema-existing="1" data-schema-module="' + esc(moduleId) + '" data-schema-field="' + esc(field) + '" style="' + SCHEMA_GRID_STYLE + 'margin-bottom:6px;">' +
        '<input class="we-schema-field-name" type="text" value="' + esc(field) + '" readonly title="基础字段不能直接重命名；可先隐藏，再新增一个字段。">' +
        schemaTypeSelectHTML(spec.type) +
        '<input class="we-schema-field-desc" type="text" value="' + esc(spec.description || '') + '">' +
        '<input class="we-schema-field-enum" type="text" value="' + esc(enumText) + '" placeholder="a, b, c">' +
        '<input class="we-schema-field-example" type="text" value="' + esc(exampleText) + '" placeholder="示例">' +
        '<label style="display:flex;gap:4px;align-items:center;font-size:11px;"><input class="we-schema-field-display" type="checkbox"' + (spec.display === false ? '' : ' checked') + '>显示</label>' +
        '<label style="display:flex;gap:4px;align-items:center;font-size:11px;"><input class="we-schema-field-hidden" type="checkbox"' + (hidden ? ' checked' : '') + '>隐藏</label>' +
        '<button class="we-icon-btn we-schema-row-copy" type="button" title="复制为新字段" style="width:28px;height:28px;"><i class="fa-solid fa-copy"></i></button>' +
      '</div>';
  }

  function buildNewSchemaRowHTML(moduleId, name, spec) {
    spec = spec || {};
    var enumText = Array.isArray(spec.enum) ? spec.enum.join(', ') : '';
    var exampleText = spec.example === undefined ? '' : JSON.stringify(spec.example);
    return '' +
      '<div class="we-schema-row we-schema-new-row" data-schema-new="1" data-schema-module="' + esc(moduleId) + '" style="' + SCHEMA_GRID_STYLE + 'margin-top:8px;">' +
        '<input class="we-schema-field-name" type="text" value="' + esc(name || '') + '" placeholder="字段名，例如 resources">' +
        schemaTypeSelectHTML(spec.type) +
        '<input class="we-schema-field-desc" type="text" value="' + esc(spec.description || '') + '" placeholder="字段说明">' +
        '<input class="we-schema-field-enum" type="text" value="' + esc(enumText) + '" placeholder="枚举，可空">' +
        '<input class="we-schema-field-example" type="text" value="' + esc(exampleText) + '" placeholder="示例，可空">' +
        '<label style="display:flex;gap:4px;align-items:center;font-size:11px;"><input class="we-schema-field-display" type="checkbox"' + (spec.display === false ? '' : ' checked') + '>显示</label>' +
        '<span></span>' +
        '<span style="display:flex;gap:2px;justify-content:flex-end;">' +
          '<button class="we-icon-btn we-schema-row-copy" type="button" title="复制字段" style="width:28px;height:28px;"><i class="fa-solid fa-copy"></i></button>' +
          '<button class="we-icon-btn we-schema-row-remove" type="button" title="删除字段行" style="width:28px;height:28px;">×</button>' +
        '</span>' +
      '</div>';
  }

  function buildModuleRowsInnerHTML(moduleId, baseSchema, mergedSchema, moduleOverride) {
    moduleOverride = moduleOverride || {};
    var hiddenMap = {};
    if (Array.isArray(moduleOverride.hiddenFields)) {
      moduleOverride.hiddenFields.map(String).forEach(function (field) { hiddenMap[field] = true; });
    }
    var overrideFields = moduleOverride.overrideFields || {};
    var addFields = moduleOverride.addFields || {};
    var mergedFields = (mergedSchema && mergedSchema.fields) || {};
    var rows = '';
    Object.keys(baseSchema.fields).forEach(function (field) {
      var spec = Object.assign({}, baseSchema.fields[field] || {}, overrideFields[field] || {}, mergedFields[field] || {});
      rows += buildExistingSchemaRowHTML(moduleId, field, spec, !!hiddenMap[field]);
    });
    Object.keys(addFields).forEach(function (field) {
      rows += buildNewSchemaRowHTML(moduleId, field, addFields[field] || {});
    });
    rows += buildNewSchemaRowHTML(moduleId, '', {});
    return rows;
  }

  function handleCopySchemaFieldRow(button) {
    var row = button && button.closest('.we-schema-row');
    if (!row) return;
    var block = row.closest('.we-schema-module-block');
    var container = block && block.querySelector('.we-schema-rows');
    if (!container) return;
    var moduleId = block.getAttribute('data-schema-module') || '';
    var nameInput = row.querySelector('.we-schema-field-name');
    var srcName = nameInput ? nameInput.value.trim() : '';
    var el = createSchemaNewRowElement(moduleId);
    el.querySelector('.we-schema-field-name').value = srcName ? (srcName + '_copy') : '';
    setSelectValue(el.querySelector('.we-schema-field-type'), (row.querySelector('.we-schema-field-type') || {}).value || 'string');
    el.querySelector('.we-schema-field-desc').value = (row.querySelector('.we-schema-field-desc') || {}).value || '';
    el.querySelector('.we-schema-field-enum').value = (row.querySelector('.we-schema-field-enum') || {}).value || '';
    el.querySelector('.we-schema-field-example').value = (row.querySelector('.we-schema-field-example') || {}).value || '';
    var srcDisp = row.querySelector('.we-schema-field-display');
    var dstDisp = el.querySelector('.we-schema-field-display');
    if (dstDisp) dstDisp.checked = srcDisp ? srcDisp.checked : true;
    container.appendChild(el);
  }

  function handleResetSchemaModule(button) {
    var block = button && button.closest('.we-schema-module-block');
    if (!block) return;
    var moduleId = block.getAttribute('data-schema-module') || '';
    var container = block.querySelector('.we-schema-rows');
    var rulesLoader = window.WORLD_ENGINE_RULES;
    if (!container || !rulesLoader || !rulesLoader.getBaseModuleOutputSchema) return;
    var baseSchema = rulesLoader.getBaseModuleOutputSchema(moduleId);
    if (!baseSchema || !baseSchema.fields) return;
    container.innerHTML = buildModuleRowsInnerHTML(moduleId, baseSchema, baseSchema, {});
    toast('已恢复默认字段，点“保存表单结构”后生效');
  }

  function validateSchemaFormIssues() {
    var errors = [], warnings = [];
    var blocks = document.querySelectorAll('.we-schema-module-block[data-schema-module]');
    for (var i = 0; i < blocks.length; i++) {
      var moduleId = blocks[i].getAttribute('data-schema-module') || '';
      var baseNames = {};
      var existing = blocks[i].querySelectorAll('.we-schema-row[data-schema-existing="1"]');
      for (var e = 0; e < existing.length; e++) {
        var bn = existing[e].getAttribute('data-schema-field');
        if (bn) baseNames[bn] = true;
      }
      var seen = {};
      var newRows = blocks[i].querySelectorAll('.we-schema-row[data-schema-new="1"]');
      for (var n = 0; n < newRows.length; n++) {
        var row = newRows[n];
        var nameInput = row.querySelector('.we-schema-field-name');
        var name = nameInput ? nameInput.value.trim() : '';
        var typeSel = row.querySelector('.we-schema-field-type');
        var descInput = row.querySelector('.we-schema-field-desc');
        var hasContent = (descInput && descInput.value.trim()) || (typeSel && typeSel.value && typeSel.value !== 'string');
        if (!name) {
          if (hasContent) errors.push('模块「' + moduleId + '」有一个新字段未填写字段名');
          continue;
        }
        if (/[^\x00-\x7F]/.test(name)) {
          warnings.push('字段名「' + name + '」含非英文字符，建议改用英文');
        } else if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
          warnings.push('字段名「' + name + '」建议只用字母、数字和下划线，且不以数字开头');
        }
        if (baseNames[name] || seen[name]) warnings.push('字段名「' + name + '」与已有字段重名，建议改名');
        seen[name] = true;
      }
    }
    return { errors: errors, warnings: warnings };
  }

  // 轻量 JSON 扫描器：返回首个错误字符的下标（-1 表示扫描未发现明显错误）
  function locateJsonErrorIndex(text) {
    var i = 0, n = text.length;
    function ws() { while (i < n) { var c = text[i]; if (c === ' ' || c === '\t' || c === '\n' || c === '\r') i++; else break; } }
    function str() { i++; while (i < n) { var c = text[i]; if (c === '\\') { i += 2; continue; } if (c === '"') { i++; return -1; } i++; } return n; }
    function num() { var s = i; if (text[i] === '-') i++; while (i < n && text[i] >= '0' && text[i] <= '9') i++; if (text[i] === '.') { i++; while (i < n && text[i] >= '0' && text[i] <= '9') i++; } if (text[i] === 'e' || text[i] === 'E') { i++; if (text[i] === '+' || text[i] === '-') i++; while (i < n && text[i] >= '0' && text[i] <= '9') i++; } return i > s ? -1 : i; }
    function val() {
      ws();
      if (i >= n) return i;
      var c = text[i];
      if (c === '"') return str();
      if (c === '{') return obj();
      if (c === '[') return arr();
      if (c === '-' || (c >= '0' && c <= '9')) return num();
      if (text.substr(i, 4) === 'true') { i += 4; return -1; }
      if (text.substr(i, 5) === 'false') { i += 5; return -1; }
      if (text.substr(i, 4) === 'null') { i += 4; return -1; }
      return i;
    }
    function obj() {
      i++; ws();
      if (text[i] === '}') { i++; return -1; }
      while (i < n) {
        ws();
        if (text[i] !== '"') return i;
        var e = str(); if (e >= 0) return e;
        ws();
        if (text[i] !== ':') return i;
        i++;
        var v = val(); if (v >= 0) return v;
        ws();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === '}') { i++; return -1; }
        return i;
      }
      return i;
    }
    function arr() {
      i++; ws();
      if (text[i] === ']') { i++; return -1; }
      while (i < n) {
        var v = val(); if (v >= 0) return v;
        ws();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === ']') { i++; return -1; }
        return i;
      }
      return i;
    }
    var r = val();
    if (r >= 0) return r;
    ws();
    if (i < n) return i;
    return -1;
  }

  function describeJsonPosition(text, pos) {
    var before = text.slice(0, pos);
    var line = before.split('\n').length;
    var col = pos - before.lastIndexOf('\n');
    var lineText = (text.split('\n')[line - 1] || '').slice(0, 80);
    return '（第 ' + line + ' 行，第 ' + col + ' 列）\n> ' + lineText;
  }

  function formatJsonParseError(text, err) {
    var msg = (err && err.message) ? err.message : String(err);
    var m = /position (\d+)/.exec(msg);
    if (m) return msg.replace(/ in JSON.*$/, '') + describeJsonPosition(text, Number(m[1]));
    var lm = /line (\d+) column (\d+)/i.exec(msg);
    if (lm) {
      var ln = Number(lm[1]);
      var lt = (text.split('\n')[ln - 1] || '').slice(0, 80);
      return msg + '\n> ' + lt;
    }
    var idx = locateJsonErrorIndex(text);
    if (idx >= 0) return 'JSON 格式错误' + describeJsonPosition(text, idx);
    return msg;
  }

  function showSchemaPreviewConfirm(jsonText) {
    return new Promise(function (resolve) {
      try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
      var overlay = document.createElement('div');
      overlay.className = 'we-confirm-overlay';
      overlay.innerHTML =
        '<div class="we-confirm-box" style="max-width:560px;width:90%;">' +
          '<p style="margin:0 0 6px;">保存前预览输出结构：</p>' +
          '<pre style="max-height:50vh;overflow:auto;text-align:left;background:var(--we-bg2,#1a1a1a);padding:8px;border-radius:4px;font-size:11px;white-space:pre-wrap;word-break:break-all;margin:0 0 8px;">' + esc(jsonText) + '</pre>' +
          '<div class="we-confirm-actions">' +
            '<button class="we-btn we-btn-danger" data-we-confirm="yes">确认保存</button>' +
            '<button class="we-btn" data-we-confirm="no">取消</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-we-confirm]');
        if (btn) {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          resolve(btn.getAttribute('data-we-confirm') === 'yes');
        } else if (e.target === overlay) {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          resolve(false);
        }
      });
    });
  }

  function buildSchemaOverridesHTML() {
    var P = getPresets();
    if (!P) return '';
    var rulesLoader = window.WORLD_ENGINE_RULES;
    var preset = P.getActivePreset();
    var isBuiltin = preset.builtin;
    var arrowClass = _collapsed.schemaOverrides ? '' : ' open';
    var bodyClass = _collapsed.schemaOverrides ? ' collapsed' : '';
    var value = JSON.stringify(preset.schemaOverrides || {}, null, 2);
    var overrides = (preset && preset.schemaOverrides) || {};
    var gridStyle = SCHEMA_GRID_STYLE;
    var builtinNote = isBuiltin
      ? '<div class="we-hint" style="margin-bottom:6px;color:var(--we-warning,#fdcb6e);">当前为内置预设，保存后会自动创建自定义副本。</div>'
      : '';

    function newFieldRowHTML(moduleId) {
      return buildNewSchemaRowHTML(moduleId, '', {});
    }

    var schemaBlocks = '';
    if (rulesLoader && rulesLoader.getModuleList && rulesLoader.getModuleOutputSchema) {
      var modules = rulesLoader.getModuleList();
      for (var mi = 0; mi < modules.length; mi++) {
        var mod = modules[mi];
        var moduleOverride = overrides[mod.moduleId] || {};
        var baseSchema = rulesLoader.getBaseModuleOutputSchema
          ? rulesLoader.getBaseModuleOutputSchema(mod.moduleId)
          : rulesLoader.getModuleOutputSchema(mod.moduleId);
        if (!baseSchema || !baseSchema.fields) continue;
        var mergedSchema = rulesLoader.getModuleOutputSchema(mod.moduleId) || baseSchema;
        var rows = buildModuleRowsInnerHTML(mod.moduleId, baseSchema, mergedSchema, moduleOverride);

        schemaBlocks += '' +
          '<div class="we-schema-module-block" data-schema-module="' + esc(mod.moduleId) + '" style="border:1px solid var(--we-border,#333);border-radius:6px;padding:8px;margin:8px 0;">' +
            '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:6px;">' +
              '<strong>' + esc(mod.comment || mod.moduleId) + '</strong>' +
              '<span class="we-hint" style="margin:0;">' + esc(baseSchema.field || mod.moduleId) + '</span>' +
            '</div>' +
            '<div style="' + gridStyle + 'font-size:11px;color:var(--we-text3,#888);margin-bottom:4px;">' +
              '<span>字段</span><span>类型</span><span>说明</span><span>枚举</span><span>示例</span><span>显示</span><span>隐藏</span><span>操作</span>' +
            '</div>' +
            '<div class="we-schema-rows">' + rows + '</div>' +
            '<div style="display:flex;gap:6px;margin-top:8px;">' +
              '<button class="we-btn we-schema-add-field" type="button" data-we-schema-add-field="' + esc(mod.moduleId) + '">新增字段</button>' +
              '<button class="we-btn we-schema-reset" type="button" data-we-schema-reset="' + esc(mod.moduleId) + '">恢复默认字段</button>' +
            '</div>' +
          '</div>';
      }
    }
    if (!schemaBlocks) schemaBlocks = '<div class="we-empty">暂无可编辑输出结构。</div>';

    return '' +
      '<hr class="we-preset-separator">' +
      '<div class="we-section">' +
        '<div class="we-collapsible-header" data-we-toggle="schemaOverrides">' +
          '<span class="we-section-title" style="margin:0;">输出结构</span>' +
          '<span class="we-collapsible-arrow' + arrowClass + '">&#9654;</span>' +
        '</div>' +
        '<div class="we-collapsible-body' + bodyClass + '" data-we-body="schemaOverrides" style="max-height:1200px;">' +
          builtinNote +
          '<div class="we-hint" style="margin-bottom:6px;">可修改字段类型、说明、枚举和示例；也可以隐藏基础字段，或为每个模块新增字段。取消“显示”后，该字段仍会进入推演结构，但不会显示在主面板卡片上。</div>' +
          schemaBlocks +
          '<button class="we-btn we-btn-primary" id="we-preset-save-schema" style="margin-top:6px;">保存表单结构</button>' +
          '<div class="we-hint" style="margin:10px 0 6px;">高级 JSON 会直接写入 schemaOverrides，适合粘贴复杂结构。</div>' +
          '<textarea id="we-preset-schema-overrides" spellcheck="false" style="min-height:180px;font-family:var(--mono-font,monospace);">' + esc(value) + '</textarea>' +
          '<button class="we-btn" id="we-preset-save-schema-json" style="margin-top:6px;">保存高级 JSON</button>' +
        '</div>' +
      '</div>';
  }  function buildTermMapHTML() {
    var P = getPresets();
    if (!P) return '';

    var preset = P.getActivePreset();
    var isBuiltin = preset.builtin;
    var map = preset.termMap || {};
    var keys = Object.keys(map);
    var arrowClass = _collapsed.termMap ? '' : ' open';
    var bodyClass = _collapsed.termMap ? ' collapsed' : '';

    var tableRows = '';
    if (keys.length === 0) {
      tableRows = '<tr><td colspan="' + (isBuiltin ? '2' : '3') + '" style="text-align:center;color:var(--we-text3,#666);">暂无术语映射</td></tr>';
    } else {
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var v = map[k];
        if (isBuiltin) {
          tableRows +=
            '<tr>' +
              '<td>' + esc(k) + '</td>' +
              '<td>' + esc(v) + '</td>' +
            '</tr>';
        } else {
          tableRows +=
            '<tr data-we-term-idx="' + i + '">' +
              '<td><input type="text" class="we-term-key" value="' + esc(k) + '"></td>' +
              '<td><input type="text" class="we-term-val" value="' + esc(v) + '"></td>' +
              '<td style="width:30px;text-align:center;"><span class="we-term-delete-btn" data-we-term-delete="' + i + '" title="删除此条">&#10005;</span></td>' +
            '</tr>';
        }
      }
    }

    var colHeaders = isBuiltin
      ? '<th>原始术语</th><th>替换为</th>'
      : '<th>原始术语</th><th>替换为</th><th></th>';

    var addRow = isBuiltin ? '' :
      '<div style="margin-top:6px;display:flex;gap:6px;">' +
        '<button class="we-btn" id="we-term-add">添加术语</button>' +
        '<button class="we-btn we-btn-primary" id="we-term-save">保存术语表</button>' +
      '</div>';

    var readonlyNote = isBuiltin
      ? '<div class="we-hint" style="margin-bottom:6px;">内置预设的术语表为只读。如需修改，请先创建自定义副本。</div>'
      : '';

    return '' +
      '<hr class="we-preset-separator">' +
      '<div class="we-section">' +
        '<div class="we-collapsible-header" data-we-toggle="termMap">' +
          '<span class="we-section-title" style="margin:0;">术语表预览 (' + keys.length + '条)</span>' +
          '<span class="we-collapsible-arrow' + arrowClass + '">&#9654;</span>' +
        '</div>' +
        '<div class="we-collapsible-body' + bodyClass + '" data-we-body="termMap" style="max-height:2000px;">' +
          readonlyNote +
          '<table class="we-term-table">' +
            '<thead><tr>' + colHeaders + '</tr></thead>' +
            '<tbody id="we-term-table-body">' + tableRows + '</tbody>' +
          '</table>' +
          addRow +
        '</div>' +
      '</div>';
  }

  // ─────────────────────────────────────────────
  // Section 4: 预设详情编辑 (Preset Detail Editor)
  // ─────────────────────────────────────────────
  function buildPresetDetailsHTML() {
    var P = getPresets();
    if (!P) return '';

    var preset = P.getActivePreset();
    if (preset.builtin) return ''; // Only show for custom presets

    var arrowClass = _collapsed.details ? '' : ' open';
    var bodyClass = _collapsed.details ? ' collapsed' : '';

    // 自由模式下，只有当预设确实引用了对应内置模块时才显示该经典系统编辑器；
    // 纯自定义自由预设不再展示声誉/势力/经济/区域这些古风残留配置。classic 模式照常全显示。
    var showClassic = function (id) {
      if (!preset || preset.mode !== 'free') return true;
      if (!Array.isArray(preset.modules)) return false;
      return preset.modules.some(function (m) {
        return m && m.kind === 'builtin' && m.id === id && m.enabled !== false;
      });
    };
    // ── Sub-section: 声誉系统 ──
    var reputationHTML = showClassic('reputation') ? buildReputationEditor(preset) : '';
    // ── Sub-section: 势力系统 ──
    var factionHTML = showClassic('factions') ? buildFactionEditor(preset) : '';
    // ── Sub-section: 经济系统 ──
    var economyHTML = showClassic('economy') ? buildEconomyEditor(preset) : '';
    // ── Sub-section: 突发事件 ──
    var incidentHTML = showClassic('regional') ? buildIncidentEditor(preset) : '';

    return '' +
      '<hr class="we-preset-separator">' +
      '<div class="we-section">' +
        '<div class="we-collapsible-header" data-we-toggle="details">' +
          '<span class="we-section-title" style="margin:0;">预设详情编辑</span>' +
          '<span class="we-collapsible-arrow' + arrowClass + '">&#9654;</span>' +
        '</div>' +
        '<div class="we-collapsible-body' + bodyClass + '" data-we-body="details" style="max-height:10000px;">' +
          '<div class="we-hint" style="margin-bottom:8px;">编辑当前自定义预设的详细配置。修改后请点击底部的"保存预设详情"按钮。</div>' +
          '<div class="we-input-group">' +
            '<label>预设名称</label>' +
            '<input type="text" id="we-detail-name" value="' + esc(preset.name) + '">' +
          '</div>' +
          '<div class="we-input-group" style="margin-top:6px;">' +
            '<label>预设描述</label>' +
            '<textarea id="we-detail-description" style="min-height:60px;">' + esc(preset.description || '') + '</textarea>' +
          '</div>' +
          reputationHTML +
          factionHTML +
          economyHTML +
          incidentHTML +
          '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">' +
            '<button class="we-btn we-btn-primary" id="we-detail-save">保存预设详情</button>' +
            '<button class="we-btn we-btn-danger" id="we-detail-delete">删除此预设</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // ── Reputation Editor ──
  function buildReputationEditor(preset) {
    var rep = preset.reputation || {};
    var dims = rep.dimensions || {};
    var levels = rep.levels || [];
    var verdicts = rep.verdicts || {};

    var dimFields = '';
    var dimKeys = ['authority', 'common', 'shadow', 'circuit'];
    var dimLabels = { authority: '权力维度', common: '民众维度', shadow: '暗面维度', circuit: '同行维度' };
    for (var i = 0; i < dimKeys.length; i++) {
      var dk = dimKeys[i];
      var dim = dims[dk] || { name: '', description: '' };
      dimFields +=
        '<div class="we-detail-field">' +
          '<label>' + dimLabels[dk] + ' - 名称</label>' +
          '<input type="text" data-we-rep-dim="' + dk + '" data-we-rep-field="name" value="' + esc(dim.name) + '">' +
        '</div>' +
        '<div class="we-detail-field">' +
          '<label>' + dimLabels[dk] + ' - 描述</label>' +
          '<input type="text" data-we-rep-dim="' + dk + '" data-we-rep-field="description" value="' + esc(dim.description) + '">' +
        '</div>';
    }

    // Levels editor
    var levelsHtml = '';
    for (var li = 0; li < levels.length; li++) {
      levelsHtml +=
        '<div class="we-detail-item-row">' +
          '<input type="text" data-we-rep-level="' + li + '" value="' + esc(levels[li]) + '" placeholder="等级 ' + (li + 1) + '">' +
        '</div>';
    }

    // Verdicts editor (per dimension per level)
    var verdictsHtml = '';
    for (var vi = 0; vi < dimKeys.length; vi++) {
      var vdk = dimKeys[vi];
      var dimVerdicts = verdicts[vdk] || {};
      verdictsHtml += '<div style="margin-top:6px;"><strong style="font-size:12px;color:var(--we-text2,#aaa);">' + esc((dims[vdk] || {}).name || dimLabels[vdk]) + ' 判定描述</strong></div>';
      for (var vli = 0; vli < levels.length; vli++) {
        var lvl = levels[vli];
        var vText = dimVerdicts[lvl] || '';
        verdictsHtml +=
          '<div class="we-detail-field">' +
            '<label>' + esc(lvl) + '</label>' +
            '<textarea data-we-rep-verdict-dim="' + vdk + '" data-we-rep-verdict-level="' + esc(lvl) + '" style="min-height:40px;">' + esc(vText) + '</textarea>' +
          '</div>';
      }
    }

    return '' +
      '<div class="we-detail-subsection">' +
        '<div class="we-detail-subsection-title">声誉系统</div>' +
        dimFields +
        '<div style="margin-top:8px;"><strong style="font-size:12px;color:var(--we-text2,#aaa);">声誉等级 (从低到高)</strong></div>' +
        levelsHtml +
        verdictsHtml +
      '</div>';
  }

  // ── Faction Editor ──
  function buildFactionEditor(preset) {
    var fac = preset.factions || {};
    var statuses = fac.statuses || [];
    var statusVerdicts = fac.statusVerdicts || {};
    var relations = fac.relations || [];
    var relationVerdicts = fac.relationVerdicts || {};

    // Statuses
    var statusRows = '';
    for (var si = 0; si < statuses.length; si++) {
      statusRows +=
        '<div class="we-detail-item-row">' +
          '<input type="text" data-we-fac-status="' + si + '" value="' + esc(statuses[si]) + '" placeholder="状态 ' + (si + 1) + '">' +
          '<span class="we-detail-item-delete" data-we-fac-status-del="' + si + '" title="删除">&#10005;</span>' +
        '</div>';
    }
    // Status verdicts
    var statusVerdictRows = '';
    for (var svi = 0; svi < statuses.length; svi++) {
      var st = statuses[svi];
      statusVerdictRows +=
        '<div class="we-detail-field">' +
          '<label>' + esc(st) + '</label>' +
          '<textarea data-we-fac-status-verdict="' + esc(st) + '" style="min-height:40px;">' + esc(statusVerdicts[st] || '') + '</textarea>' +
        '</div>';
    }

    // Relations
    var relationRows = '';
    for (var ri = 0; ri < relations.length; ri++) {
      relationRows +=
        '<div class="we-detail-item-row">' +
          '<input type="text" data-we-fac-relation="' + ri + '" value="' + esc(relations[ri]) + '" placeholder="关系 ' + (ri + 1) + '">' +
          '<span class="we-detail-item-delete" data-we-fac-relation-del="' + ri + '" title="删除">&#10005;</span>' +
        '</div>';
    }
    // Relation verdicts
    var relationVerdictRows = '';
    for (var rvi = 0; rvi < relations.length; rvi++) {
      var rel = relations[rvi];
      relationVerdictRows +=
        '<div class="we-detail-field">' +
          '<label>' + esc(rel) + '</label>' +
          '<textarea data-we-fac-relation-verdict="' + esc(rel) + '" style="min-height:40px;">' + esc(relationVerdicts[rel] || '') + '</textarea>' +
        '</div>';
    }

    return '' +
      '<div class="we-detail-subsection">' +
        '<div class="we-detail-subsection-title">势力系统</div>' +
        '<div><strong style="font-size:12px;color:var(--we-text2,#aaa);">势力状态 (从强到弱)</strong></div>' +
        statusRows +
        '<button class="we-btn" data-we-fac-add-status style="margin:4px 0 8px;">添加状态</button>' +
        '<div style="margin-top:4px;"><strong style="font-size:12px;color:var(--we-text2,#aaa);">状态判定描述</strong></div>' +
        statusVerdictRows +
        '<div style="margin-top:10px;"><strong style="font-size:12px;color:var(--we-text2,#aaa);">势力关系 (从亲密到敌对)</strong></div>' +
        relationRows +
        '<button class="we-btn" data-we-fac-add-relation style="margin:4px 0 8px;">添加关系</button>' +
        '<div style="margin-top:4px;"><strong style="font-size:12px;color:var(--we-text2,#aaa);">关系判定描述</strong></div>' +
        relationVerdictRows +
      '</div>';
  }

  // ── Economy Editor ──
  function buildEconomyEditor(preset) {
    var eco = preset.economy || {};
    var climates = eco.climates || [];
    var climateVerdicts = eco.climateVerdicts || {};

    var climateRows = '';
    for (var ci = 0; ci < climates.length; ci++) {
      climateRows +=
        '<div class="we-detail-item-row">' +
          '<input type="text" data-we-eco-climate="' + ci + '" value="' + esc(climates[ci]) + '" placeholder="经济状态 ' + (ci + 1) + '">' +
          '<span class="we-detail-item-delete" data-we-eco-climate-del="' + ci + '" title="删除">&#10005;</span>' +
        '</div>';
    }

    var verdictRows = '';
    for (var cvi = 0; cvi < climates.length; cvi++) {
      var clim = climates[cvi];
      verdictRows +=
        '<div class="we-detail-field">' +
          '<label>' + esc(clim) + '</label>' +
          '<textarea data-we-eco-climate-verdict="' + esc(clim) + '" style="min-height:40px;">' + esc(climateVerdicts[clim] || '') + '</textarea>' +
        '</div>';
    }

    return '' +
      '<div class="we-detail-subsection">' +
        '<div class="we-detail-subsection-title">经济系统</div>' +
        '<div><strong style="font-size:12px;color:var(--we-text2,#aaa);">经济气候 (从好到差)</strong></div>' +
        climateRows +
        '<button class="we-btn" data-we-eco-add-climate style="margin:4px 0 8px;">添加状态</button>' +
        '<div style="margin-top:4px;"><strong style="font-size:12px;color:var(--we-text2,#aaa);">经济判定描述</strong></div>' +
        verdictRows +
      '</div>';
  }

  // ── Incident Editor ──
  function buildIncidentEditor(preset) {
    var inc = preset.regionalIncidents || {};
    var types = inc.types || [];

    var incidentCards = '';
    for (var ii = 0; ii < types.length; ii++) {
      var t = types[ii];
      incidentCards +=
        '<div class="we-incident-card" data-we-inc-idx="' + ii + '">' +
          '<div class="we-incident-card-header">' +
            '<span>#' + (ii + 1) + '</span>' +
            '<span class="we-detail-item-delete" data-we-inc-del="' + ii + '" title="删除此事件">&#10005;</span>' +
          '</div>' +
          '<div class="we-detail-field">' +
            '<label>类型标识 (英文)</label>' +
            '<input type="text" data-we-inc-type="' + ii + '" value="' + esc(t.type) + '">' +
          '</div>' +
          '<div class="we-detail-field">' +
            '<label>显示名称</label>' +
            '<input type="text" data-we-inc-label="' + ii + '" value="' + esc(t.label) + '">' +
          '</div>' +
          '<div class="we-detail-field">' +
            '<label>权重 (数值)</label>' +
            '<input type="number" data-we-inc-weight="' + ii + '" value="' + (t.weight || 0) + '" min="0" max="100">' +
          '</div>' +
          '<div class="we-detail-field">' +
            '<label>事件描述</label>' +
            '<textarea data-we-inc-guide="' + ii + '" style="min-height:50px;">' + esc(t.guide || '') + '</textarea>' +
          '</div>' +
        '</div>';
    }

    return '' +
      '<div class="we-detail-subsection">' +
        '<div class="we-detail-subsection-title">突发事件</div>' +
        '<div style="display:flex;gap:10px;margin-bottom:8px;">' +
          '<div class="we-detail-field" style="flex:1;">' +
            '<label>触发概率</label>' +
            '<input type="number" id="we-inc-chance" value="' + (inc.chance || 0.03) + '" step="0.01" min="0" max="1">' +
          '</div>' +
          '<div class="we-detail-field" style="flex:1;">' +
            '<label>持续回合</label>' +
            '<input type="number" id="we-inc-duration" value="' + (inc.durationRounds || 5) + '" min="1" max="50">' +
          '</div>' +
          '<div class="we-detail-field" style="flex:1;">' +
            '<label>冷却回合</label>' +
            '<input type="number" id="we-inc-cooldown" value="' + (inc.cooldownRounds || 5) + '" min="0" max="50">' +
          '</div>' +
        '</div>' +
        '<div><strong style="font-size:12px;color:var(--we-text2,#aaa);">事件类型列表</strong></div>' +
        incidentCards +
        '<button class="we-btn" id="we-inc-add" style="margin-top:6px;">添加事件类型</button>' +
      '</div>';
  }

  // ─────────────────────────────────────────────
  // Build Full Preset HTML
  // ─────────────────────────────────────────────
  function buildPresetHTML() {
    var P = getPresets();
    if (!P) return '<div class="we-empty">预设系统未加载</div>';

    return '' +
      buildPresetSelectorHTML() +
      buildModeModulesHTML() +
      buildRulesEditorHTML() +
      buildModuleTogglesHTML() +
      buildSchemaOverridesHTML() +
      buildPresetDetailsHTML();
  }

  // ─────────────────────────────────────────────
  // Injection Logic
  // ─────────────────────────────────────────────
  function tryInjectPresetUI() {
    var saveBtn = document.getElementById('we-save-settings');
    if (!saveBtn) {
      _injected = false;
      return;
    }

    var existing = document.getElementById('we-preset-section');
    if (existing && existing.isConnected) {
      _injected = true;
      return;
    }
    _injected = false;

    // Find the parent container of save/reset buttons
    var actionsDiv = saveBtn.closest('.we-settings-save-actions');
    if (!actionsDiv) {
      // Fallback: insert before the save button's parent
      actionsDiv = saveBtn.parentNode;
    }
    if (!actionsDiv) return;

    // Remove old preset section if it exists (safety)
    var old = document.getElementById('we-preset-section');
    if (old) old.parentNode.removeChild(old);

    // Insert preset UI before the save/reset actions
    var presetSection = document.createElement('div');
    presetSection.id = 'we-preset-section';
    presetSection.innerHTML = buildPresetHTML();
    actionsDiv.parentNode.insertBefore(presetSection, actionsDiv);
    _injected = true;
  }

  // ─────────────────────────────────────────────
  // Re-render just the preset section (without full panel refresh)
  // ─────────────────────────────────────────────
  function refreshPresetSection() {
    var section = document.getElementById('we-preset-section');
    if (!section) return;
    section.innerHTML = buildPresetHTML();
  }

  // ─────────────────────────────────────────────
  // Event Handlers (Delegation)
  // ─────────────────────────────────────────────
  function handleClick(e) {
    var target = e.target;

    // ── Collapsible toggle ──
    var toggleHeader = target.closest('[data-we-toggle]');
    if (toggleHeader) {
      var key = toggleHeader.getAttribute('data-we-toggle');
      _collapsed[key] = !_collapsed[key];
      var body = document.querySelector('[data-we-body="' + key + '"]');
      var arrow = toggleHeader.querySelector('.we-collapsible-arrow');
      if (body) body.classList.toggle('collapsed', _collapsed[key]);
      if (arrow) arrow.classList.toggle('open', !_collapsed[key]);
      return;
    }

    // ── Apply preset ──
    if (target.id === 'we-preset-apply' || target.closest('#we-preset-apply')) {
      handleApplyPreset();
      return;
    }

    // ── Generate from worldbook ──
    if (target.id === 'we-preset-generate' || target.closest('#we-preset-generate')) {
      _generateMenuOpen = !_generateMenuOpen;
      refreshPresetSection();
      if (_generateMenuOpen) loadGenerateEntries(true);
      return;
    }

    if (target.id === 'we-preset-generate-close' || target.closest('#we-preset-generate-close')) {
      _generateMenuOpen = false;
      refreshPresetSection();
      return;
    }

    if (target.closest('[data-we-generate-sync]')) {
      _generateSelectedIds = null;
      loadGenerateEntries(true);
      return;
    }

    if (target.closest('[data-we-generate-select-all]')) {
      _generateSelectedIds = getEnabledGenerateEntryIds();
      saveGenerateEntryIds(_generateSelectedIds);
      refreshPresetSection();
      return;
    }

    if (target.closest('[data-we-generate-clear]')) {
      _generateSelectedIds = [];
      saveGenerateEntryIds(_generateSelectedIds);
      refreshPresetSection();
      return;
    }

    if (target.closest('[data-we-generate-refresh]')) {
      loadGenerateEntries(false);
      return;
    }

    if (target.id === 'we-preset-generate-start' || target.closest('#we-preset-generate-start')) {
      handleGenerate();
      return;
    }

    // ── Import preset ──
    if (target.id === 'we-preset-import' || target.closest('#we-preset-import')) {
      var fileInput = document.getElementById('we-preset-file-input');
      if (fileInput) fileInput.click();
      return;
    }

    // ── Export preset ──
    if (target.id === 'we-preset-export' || target.closest('#we-preset-export')) {
      handleExport();
      return;
    }

    // ── Delete current preset ──
    if (target.id === 'we-preset-delete' || target.closest('#we-preset-delete')) {
      handleDeletePreset();
      return;
    }

    if (target.id === 'we-preset-save-mode' || target.closest('#we-preset-save-mode')) {
      handleSaveMode();
      return;
    }

    if (target.id === 'we-free-add-custom' || target.closest('#we-free-add-custom')) {
      handleAddFreeCustomModule();
      return;
    }

    if (target.id === 'we-free-add-builtin' || target.closest('#we-free-add-builtin')) {
      handleAddFreeBuiltinModule();
      return;
    }

    if (target.id === 'we-free-save-modules' || target.closest('#we-free-save-modules')) {
      handleSaveFreeModules();
      return;
    }

    if (target.closest('.we-free-module-up')) {
      moveFreeModuleCard(target.closest('.we-free-module-up'), -1);
      return;
    }

    if (target.closest('.we-free-module-down')) {
      moveFreeModuleCard(target.closest('.we-free-module-down'), 1);
      return;
    }

    if (target.closest('.we-free-module-delete')) {
      var freeCard = target.closest('.we-free-module-card');
      if (freeCard && freeCard.parentNode) freeCard.parentNode.removeChild(freeCard);
      return;
    }

    if (target.closest('.we-free-add-field')) {
      var freeModuleCard = target.closest('.we-free-module-card');
      var freeFields = freeModuleCard && freeModuleCard.querySelector('.we-free-module-fields');
      if (freeFields) freeFields.appendChild(createSchemaNewRowElement(''));
      return;
    }

    if (target.closest('[data-we-mech-template]')) {
      applyMechanicsTemplate(target.closest('[data-we-mech-template]'));
      return;
    }
    // ── Save custom rules ──
    if (target.id === 'we-preset-save-rules' || target.closest('#we-preset-save-rules')) {
      handleSaveRules();
      return;
    }

    if (target.classList && target.classList.contains('we-module-toggle-cb')) {
      var label = target.closest('.we-module-toggle-row');
      if (label) {
        var span = label.querySelector('span');
        if (span) {
          span.style.opacity = target.checked ? '' : '0.5';
          span.style.textDecoration = target.checked ? '' : 'line-through';
        }
      }
      return;
    }

    if (target.id === 'we-preset-save-modules' || target.closest('#we-preset-save-modules')) {
      handleSaveModules();
      return;
    }

    if (target.id === 'we-preset-save-schema' || target.closest('#we-preset-save-schema')) {
      handleSaveSchemaOverrides();
      return;
    }

    if (target.id === 'we-preset-save-schema-json' || target.closest('#we-preset-save-schema-json')) {
      handleSaveSchemaOverridesJson();
      return;
    }
    if (target.closest('[data-we-schema-add-field]')) {
      handleAddSchemaFieldRow(target.closest('[data-we-schema-add-field]'));
      return;
    }

    if (target.closest('.we-schema-row-copy')) {
      handleCopySchemaFieldRow(target.closest('.we-schema-row-copy'));
      return;
    }

    if (target.closest('[data-we-schema-reset]')) {
      handleResetSchemaModule(target.closest('[data-we-schema-reset]'));
      return;
    }

    if (target.closest('.we-schema-row-remove')) {
      handleRemoveSchemaFieldRow(target.closest('.we-schema-row-remove'));
      return;
    }

    // ── Term map: add entry ──
    if (target.id === 'we-term-add' || target.closest('#we-term-add')) {
      handleAddTerm();
      return;
    }

    // ── Term map: save ──
    if (target.id === 'we-term-save' || target.closest('#we-term-save')) {
      handleSaveTermMap();
      return;
    }

    // ── Term map: delete entry ──
    var termDelBtn = target.closest('[data-we-term-delete]');
    if (termDelBtn) {
      handleDeleteTerm(parseInt(termDelBtn.getAttribute('data-we-term-delete'), 10));
      return;
    }

    // ── Detail: save preset details ──
    if (target.id === 'we-detail-save' || target.closest('#we-detail-save')) {
      handleSaveDetails();
      return;
    }

    // ── Detail: delete preset ──
    if (target.id === 'we-detail-delete' || target.closest('#we-detail-delete')) {
      handleDeletePreset();
      return;
    }

    // ── Faction: add status ──
    if (target.closest('[data-we-fac-add-status]')) {
      handleFacAddStatus();
      return;
    }

    // ── Faction: delete status ──
    var facStatusDel = target.closest('[data-we-fac-status-del]');
    if (facStatusDel) {
      handleFacDeleteStatus(parseInt(facStatusDel.getAttribute('data-we-fac-status-del'), 10));
      return;
    }

    // ── Faction: add relation ──
    if (target.closest('[data-we-fac-add-relation]')) {
      handleFacAddRelation();
      return;
    }

    // ── Faction: delete relation ──
    var facRelDel = target.closest('[data-we-fac-relation-del]');
    if (facRelDel) {
      handleFacDeleteRelation(parseInt(facRelDel.getAttribute('data-we-fac-relation-del'), 10));
      return;
    }

    // ── Economy: add climate ──
    if (target.closest('[data-we-eco-add-climate]')) {
      handleEcoAddClimate();
      return;
    }

    // ── Economy: delete climate ──
    var ecoClimateDel = target.closest('[data-we-eco-climate-del]');
    if (ecoClimateDel) {
      handleEcoDeleteClimate(parseInt(ecoClimateDel.getAttribute('data-we-eco-climate-del'), 10));
      return;
    }

    // ── Incident: add ──
    if (target.id === 'we-inc-add' || target.closest('#we-inc-add')) {
      handleIncidentAdd();
      return;
    }

    // ── Incident: delete ──
    var incDel = target.closest('[data-we-inc-del]');
    if (incDel) {
      handleIncidentDelete(parseInt(incDel.getAttribute('data-we-inc-del'), 10));
      return;
    }
  }

  function handleChange(e) {
    var target = e.target;

    if (target.classList && target.classList.contains('we-generate-entry-cb')) {
      readGenerateSelectedIdsFromDOM();
      refreshPresetSection();
      return;
    }

    if (target.id === 'we-preset-generate-character') {
      saveGenerateWithCharacter(!!target.checked);
      return;
    }

    if (target.id === 'we-preset-show-stability') {
      var Pss = getPresets();
      var apss = Pss && Pss.getActivePreset ? Pss.getActivePreset() : null;
      if (apss) {
        try { window.WORLD_ENGINE_STORE.setItem('world_engine_show_stability_' + apss.id, target.checked ? 'true' : 'false'); } catch (e) {}
      }
      if (window.WORLD_ENGINE_UI && typeof window.WORLD_ENGINE_UI.refresh === 'function') window.WORLD_ENGINE_UI.refresh(false);
      return;
    }

    if (target.classList && target.classList.contains('we-free-module-kind')) {
      var card = target.closest('.we-free-module-card');
      if (card && card.parentNode) {
        var index = Array.prototype.indexOf.call(card.parentNode.querySelectorAll('.we-free-module-card'), card);
        var next;
        if (target.value === 'builtin') {
          var first = (document.getElementById('we-free-builtin-select') || {}).value || 'events';
          next = buildFreeModuleCardHTML(cloneBuiltinModuleRef(first, index + 1), index);
        } else {
          next = buildFreeModuleCardHTML({ id: 'customModule' + (index + 1), name: '自定义模块', kind: 'custom', enabled: true, order: index + 1, container: 'array', field: 'customModule' + (index + 1), itemKey: 'name', fields: { name: { type: 'string', description: '名称', example: '条目' } }, display: { style: 'cards', titleField: 'name' }, mechanics: {} }, index);
        }
        card.insertAdjacentHTML('afterend', next);
        card.parentNode.removeChild(card);
      }
      return;
    }
    // ── File input for import ──
    if (target.id === 'we-preset-file-input') {
      handleFileImport(target);
      return;
    }
  }

  // ── Handler: Apply Preset ──
  function handleApplyPreset() {
    var P = getPresets();
    if (!P) return;

    var selector = document.getElementById('we-preset-selector');
    if (!selector) return;

    var newId = selector.value;
    if (P.setActivePreset(newId)) {
      toast('已切换预设: ' + (P.getActivePreset().name));
      refreshPresetSection();
      // Refresh the main panel to reflect new preset
      if (window.WORLD_ENGINE_UI && typeof window.WORLD_ENGINE_UI.refresh === 'function') {
        window.WORLD_ENGINE_UI.refresh(false);
      }
    } else {
      toastError('切换预设失败');
    }
  }

  // ── Handler: Generate from Worldbook ──
  async function handleGenerate() {
    var P = getPresets();
    if (!P) return;
    if (_generating) return;

    var includeCharacterDescription = !!(document.getElementById('we-preset-generate-character') || {}).checked;
    var modeInput = document.querySelector('input[name="we-preset-generate-mode"]:checked');
    var generationMode = modeInput ? modeInput.value : getGenerateMode();
    var autoCropInput = document.getElementById('we-preset-generate-auto-crop');
    var countModeInput = document.getElementById('we-preset-generate-count-mode');
    var countInput = document.getElementById('we-preset-generate-count');
    var autoCropModules = autoCropInput ? !!autoCropInput.checked : getGenerateAutoCrop();
    var moduleCountMode = countModeInput ? countModeInput.value : getGenerateCountMode();
    var moduleCount = countInput ? countInput.value : getGenerateCount();
    var guidanceInput = document.getElementById('we-preset-generate-guidance');
    _generateGuidance = guidanceInput ? guidanceInput.value : _generateGuidance;
    saveGenerateMode(generationMode);
    saveGenerateAutoCrop(autoCropModules);
    saveGenerateCountMode(moduleCountMode);
    saveGenerateCount(moduleCount);
    var selectedWorldbookIds = _generateMenuOpen ? readGenerateSelectedIdsFromDOM() : null;
    if (_generateMenuOpen && (!selectedWorldbookIds || !selectedWorldbookIds.length) && !includeCharacterDescription) {
      toastError('请至少选择一个世界书条目，或勾选角色卡描述');
      return;
    }

    _generating = true;
    var genBtn = document.getElementById('we-preset-generate');
    if (genBtn) genBtn.disabled = true;

    // Show loading indicator
    refreshPresetSection();

    try {
      saveGenerateWithCharacter(includeCharacterDescription);
      var newPreset = await P.generateFromWorldbook({
        includeCharacterDescription: includeCharacterDescription,
        worldbookEntryIds: selectedWorldbookIds,
        generationMode: generationMode,
        autoCropModules: autoCropModules,
        moduleCountMode: moduleCountMode,
        moduleCount: moduleCount,
        userGuidance: _generateGuidance
      });
      if (newPreset) {
        // Switch to the newly generated preset
        P.setActivePreset(newPreset.id);
        toast('已从设定生成预设: ' + newPreset.name);
        // Refresh the main panel
        if (window.WORLD_ENGINE_UI && typeof window.WORLD_ENGINE_UI.refresh === 'function') {
          window.WORLD_ENGINE_UI.refresh(false);
        }
      }
    } catch (err) {
      toastError('生成预设失败: ' + (err.message || err));
    } finally {
      _generating = false;
      refreshPresetSection();
    }
  }

  // ── Handler: Export ──
  function handleExport() {
    var P = getPresets();
    if (!P) return;

    var activeId = P.getActivePresetId();
    var jsonStr = P.exportPreset(activeId);
    if (!jsonStr) {
      toastError('导出失败: 无法获取预设数据');
      return;
    }

    var preset = P.getActivePreset();
    var filename = '世界引擎预设_' + (preset.name || activeId) + '.json';

    var blob = new Blob([jsonStr], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 1000);
    toast('已导出预设: ' + preset.name);
  }

  // ── Handler: File Import ──
  function handleFileImport(fileInput) {
    var P = getPresets();
    if (!P) return;

    var file = fileInput.files && fileInput.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        // 导入前校验 schemaOverrides 字段格式，给出提示（不阻断导入）
        if (typeof P.validateSchemaOverrides === 'function') {
          try {
            var rawPreset = JSON.parse(ev.target.result);
            var schemaWarnings = P.validateSchemaOverrides(rawPreset && rawPreset.schemaOverrides);
            schemaWarnings.slice(0, 4).forEach(function (w) { toastWarning(w); });
          } catch (ignore) {}
        }
        var result = P.importPreset(ev.target.result);
        if (result) {
          // Switch to imported preset
          P.setActivePreset(result.id);
          toast('已导入预设: ' + result.name);
          refreshPresetSection();
          if (window.WORLD_ENGINE_UI && typeof window.WORLD_ENGINE_UI.refresh === 'function') {
            window.WORLD_ENGINE_UI.refresh(false);
          }
        } else {
          toastError('导入失败: 无效的预设文件');
        }
      } catch (err) {
        toastError('导入失败: ' + (err.message || err));
      }
    };
    reader.onerror = function () {
      toastError('读取文件失败');
    };
    reader.readAsText(file);

    // Reset file input so same file can be selected again
    fileInput.value = '';
  }

  // ── Handler: Save Custom Rules ──
  function handleSaveRules() {
    var P = getPresets();
    if (!P) return;

    var textarea = document.getElementById('we-preset-custom-rules');
    if (!textarea) return;

    var rulesText = textarea.value || '';
    var preset = P.getActivePreset();

    if (preset.builtin) {
      // Create a copy of the built-in preset
      var copy = deepClone(preset);
      copy.id = generateId();
      copy.name = preset.name + ' (自定义)';
      copy.builtin = false;
      copy.customRules = rulesText;
      P.saveCustomPreset(copy);
      P.setActivePreset(copy.id);
      toast('已创建自定义副本并保存规则: ' + copy.name);
      refreshPresetSection();
      if (window.WORLD_ENGINE_UI && typeof window.WORLD_ENGINE_UI.refresh === 'function') {
        window.WORLD_ENGINE_UI.refresh(false);
      }
    } else {
      // Update existing custom preset
      preset.customRules = rulesText;
      P.saveCustomPreset(preset);
      toast('自定义规则已保存');
    }
  }

  // ── Handler: Add Term ──
  function createSchemaNewRowElement(moduleId) {
    var wrap = document.createElement('div');
    wrap.innerHTML = buildNewSchemaRowHTML(moduleId || '', '', {});
    return wrap.firstChild;
  }

  function handleAddSchemaFieldRow(button) {
    var block = button && button.closest('.we-schema-module-block');
    if (!block) return;
    var moduleId = block.getAttribute('data-schema-module') || '';
    var container = block.querySelector('.we-schema-rows');
    if (container) container.appendChild(createSchemaNewRowElement(moduleId));
    else block.insertBefore(createSchemaNewRowElement(moduleId), button);
  }

  function handleRemoveSchemaFieldRow(button) {
    var row = button && button.closest('.we-schema-row[data-schema-new="1"]');
    if (row && row.parentNode) row.parentNode.removeChild(row);
  }
  function splitCsvValue(text) {
    return String(text || '').split(',').map(function (item) { return item.trim(); }).filter(Boolean);
  }

  function parseFreeJson(text, label, errors) {
    text = String(text || '').trim();
    if (!text) return null;
    try {
      var parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(label + ' 必须是对象');
      return parsed;
    } catch (err) {
      errors.push(label + ' JSON 无法解析：' + (err && err.message ? err.message : err));
      return null;
    }
  }


  function isPlainConfigObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function isNonEmptyStringArray(value) {
    return Array.isArray(value) && value.some(function (item) { return String(item || '').trim(); });
  }

  function hasStageOrderConfig(config) {
    if (isNonEmptyStringArray(config.states) || isNonEmptyStringArray(config.order)) return true;
    if (!isPlainConfigObject(config.order)) return false;
    return Object.keys(config.order).some(function (type) { return isNonEmptyStringArray(config.order[type]); });
  }

  function hasVerdictLevelsConfig(config) {
    if (isNonEmptyStringArray(config.levels)) return true;
    if (!isPlainConfigObject(config.levels)) return false;
    return Object.keys(config.levels).some(function (axis) { return isNonEmptyStringArray(config.levels[axis]); });
  }

  function validateFreeDiceConfig(config, errors, moduleId) {
    if (!isPlainConfigObject(config)) {
      errors.push('Module ' + moduleId + ' dice config must be an object');
      return;
    }
    if (['threshold', 'decay', 'trigger'].indexOf(config.mode) === -1) {
      errors.push('Module ' + moduleId + ' dice.mode must be threshold, decay, or trigger');
      return;
    }
    if (config.mode === 'decay' && !isPlainConfigObject(config.table)) errors.push('Module ' + moduleId + ' decay dice needs table');
    if (config.mode === 'trigger' && !isNonEmptyStringArray((config.typeWeights || []).map(function (item) { return item && item.type; }))) {
      errors.push('Module ' + moduleId + ' trigger dice needs typeWeights with type');
    }
    ['chance', 'durationRounds', 'cooldownRounds', 'defaultBase', 'setbackRatio', 'progressMax'].forEach(function (key) {
      if (config[key] != null && !Number.isFinite(Number(config[key]))) errors.push('Module ' + moduleId + ' dice.' + key + ' must be numeric');
    });
  }

  function validateFreeStagesConfig(config, errors, moduleId) {
    if (!isPlainConfigObject(config)) {
      errors.push('Module ' + moduleId + ' stages config must be an object');
      return;
    }
    if (!hasStageOrderConfig(config)) errors.push('Module ' + moduleId + ' stages needs states or order');
    if (config.progressMax != null && (!Number.isFinite(Number(config.progressMax)) || Number(config.progressMax) <= 0)) {
      errors.push('Module ' + moduleId + ' stages.progressMax must be greater than 0');
    }
  }

  function validateFreeVerdictsConfig(config, errors, moduleId) {
    if (!isPlainConfigObject(config)) {
      errors.push('Module ' + moduleId + ' verdicts config must be an object');
      return;
    }
    if (!isNonEmptyStringArray(config.axes)) errors.push('Module ' + moduleId + ' verdicts needs axes');
    if (!hasVerdictLevelsConfig(config)) errors.push('Module ' + moduleId + ' verdicts needs levels');
  }

  function collectFreeFields(card, errors, moduleId) {
    var rows = card.querySelectorAll('.we-free-module-fields .we-schema-row[data-schema-new="1"]');
    var fields = {}, seen = {};
    for (var i = 0; i < rows.length; i++) {
      var nameInput = rows[i].querySelector('.we-schema-field-name');
      var name = nameInput ? nameInput.value.trim() : '';
      var hasContent = Array.from(rows[i].querySelectorAll('input,select')).some(function (el) {
        if (el.classList && el.classList.contains('we-schema-field-name')) return false;
        if (el.type === 'checkbox') return false;
        return String(el.value || '').trim() && String(el.value || '').trim() !== 'string';
      });
      if (!name) {
        if (hasContent) errors.push('模块 ' + moduleId + ' 有字段未填写字段名');
        continue;
      }
      if (!isStrictIdentifier(name)) errors.push('模块 ' + moduleId + ' 字段名非法：' + name);
      if (seen[name]) errors.push('模块 ' + moduleId + ' 字段重复：' + name);
      seen[name] = true;
      fields[name] = buildSchemaFieldSpecFromRow(rows[i]);
    }
    return fields;
  }

  function collectFreeMechanics(card, errors, moduleId) {
    var mechanics = {};
    var checks = card.querySelectorAll('.we-free-mech-enabled[data-mech]');
    for (var i = 0; i < checks.length; i++) {
      var key = checks[i].getAttribute('data-mech');
      if (!checks[i].checked) continue;
      var textarea = card.querySelector('.we-free-mech-json[data-mech="' + key + '"]');
      var parsed = parseFreeJson(textarea ? textarea.value : '', moduleId + '.' + key, errors) || {};
      if (key === 'dice') validateFreeDiceConfig(parsed, errors, moduleId);
      if (key === 'stages') validateFreeStagesConfig(parsed, errors, moduleId);
      if (key === 'verdicts') validateFreeVerdictsConfig(parsed, errors, moduleId);
      mechanics[key] = parsed;
    }
    return mechanics;
  }

  function getReservedBuiltinFields() {
    var rulesLoader = window.WORLD_ENGINE_RULES;
    var reserved = { world_digest: true };
    if (rulesLoader && rulesLoader.getModuleDescriptors) {
      var descriptors = rulesLoader.getModuleDescriptors();
      for (var i = 0; i < descriptors.length; i++) if (descriptors[i].field) reserved[descriptors[i].field] = true;
    }
    return reserved;
  }

  function collectFreeModulesFromForm() {
    var cards = document.querySelectorAll('.we-free-module-card[data-free-module-index]');
    var modules = [], errors = [], seenIds = {}, seenFields = {}, reserved = getReservedBuiltinFields();
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var kindSel = card.querySelector('.we-free-module-kind');
      var kind = kindSel && kindSel.value === 'builtin' ? 'builtin' : 'custom';
      var enabled = !(card.querySelector('.we-free-module-enabled') && !card.querySelector('.we-free-module-enabled').checked);
      var orderInput = card.querySelector('.we-free-module-order');
      var order = Number(orderInput && orderInput.value);
      if (kind === 'builtin') {
        var builtinSel = card.querySelector('.we-free-module-builtin-id');
        var bid = builtinSel ? builtinSel.value : '';
        if (!bid) { errors.push('内置引用缺少模块 id'); continue; }
        if (seenIds[bid]) errors.push('模块 id 重复：' + bid);
        seenIds[bid] = true;
        modules.push({ id: bid, kind: 'builtin', enabled: enabled, order: Number.isFinite(order) ? order : i + 1 });
        continue;
      }
      var idInput = card.querySelector('.we-free-module-id');
      var id = idInput ? idInput.value.trim() : '';
      if (!isStrictIdentifier(id)) errors.push('自定义模块 id 非法：' + (id || '(空)'));
      if (seenIds[id]) errors.push('模块 id 重复：' + id);
      seenIds[id] = true;
      var nameInput = card.querySelector('.we-free-module-name');
      var fieldInput = card.querySelector('.we-free-module-field');
      var field = (fieldInput && fieldInput.value.trim()) || id;
      if (!isStrictIdentifier(field)) errors.push('模块 ' + id + ' state 字段名非法：' + field);
      if (reserved[field]) errors.push('模块 ' + id + ' 字段名与内置字段冲突：' + field);
      if (seenFields[field]) errors.push('模块字段名重复：' + field);
      seenFields[field] = true;
      var container = (card.querySelector('.we-free-module-container') || {}).value || 'array';
      var descriptor = {
        id: id,
        name: (nameInput && nameInput.value.trim()) || id,
        kind: 'custom',
        enabled: enabled,
        order: Number.isFinite(order) ? order : i + 1,
        container: container,
        field: container === 'none' ? null : field,
        rules: ((card.querySelector('.we-free-module-rules') || {}).value || '').trim(),
        fields: collectFreeFields(card, errors, id),
        display: {
          style: ((card.querySelector('.we-free-display-style') || {}).value || 'cards'),
          titleField: ((card.querySelector('.we-free-display-title') || {}).value || '').trim(),
          badgeFields: splitCsvValue((card.querySelector('.we-free-display-badges') || {}).value),
          bodyFields: splitCsvValue((card.querySelector('.we-free-display-body') || {}).value),
          emptyText: ((card.querySelector('.we-free-display-empty') || {}).value || '').trim()
        },
        mechanics: collectFreeMechanics(card, errors, id)
      };
      if (['array', 'object', 'scalar', 'none'].indexOf(container) === -1) errors.push('Module ' + id + ' container is invalid: ' + container);
      if (container === 'array') descriptor.itemKey = ((card.querySelector('.we-free-module-item-key') || {}).value || 'name').trim() || 'name';
      if ((container === 'array' || container === 'object') && !Object.keys(descriptor.fields || {}).length) errors.push('Module ' + id + ' needs at least one field');
      if (container === 'array' && descriptor.itemKey && descriptor.fields && !descriptor.fields[descriptor.itemKey]) errors.push('Module ' + id + ' itemKey must match a field: ' + descriptor.itemKey);
      if (container === 'scalar') delete descriptor.fields;
      if (container === 'none') { descriptor.field = null; delete descriptor.fields; }
      modules.push(descriptor);
    }
    return { modules: modules, errors: errors };
  }

  function savePresetAfterFreeEdit(preset, message) {
    var P = getPresets();
    if (!P || !preset) return;
    P.saveCustomPreset(preset);
    P.setActivePreset(preset.id);
    toast(message || '自由模块已保存');
    refreshPresetSection();
    if (window.WORLD_ENGINE_UI && typeof window.WORLD_ENGINE_UI.refresh === 'function') window.WORLD_ENGINE_UI.refresh(false);
  }

  function handleSaveMode() {
    var P = getPresets();
    if (!P) return;
    var preset = ensureCustomPresetForEdit(P.getActivePreset(), '已创建自定义副本用于切换模式');
    if (!preset) return;
    var selected = document.querySelector('input[name="we-preset-mode"]:checked');
    var mode = selected ? selected.value : 'classic';
    preset.mode = mode === 'free' ? 'free' : 'classic';
    if (preset.mode === 'free' && (!Array.isArray(preset.modules) || !preset.modules.length)) preset.modules = seedFreeModulesFromClassic(preset);
    if (preset.mode === 'classic') preset.modules = [];
    savePresetAfterFreeEdit(preset, '模式已保存：' + preset.mode);
  }

  function handleAddFreeCustomModule() {
    var list = document.getElementById('we-free-modules-list');
    if (!list) return;
    var count = list.querySelectorAll('.we-free-module-card').length;
    var id = 'customModule' + (count + 1);
    var html = buildFreeModuleCardHTML({ id: id, name: '自定义模块', kind: 'custom', enabled: true, order: count + 1, container: 'array', field: id, itemKey: 'name', fields: { name: { type: 'string', description: '名称', example: '条目' } }, display: { style: 'cards', titleField: 'name' }, mechanics: {} }, count);
    if (list.querySelector('.we-empty')) list.innerHTML = '';
    list.insertAdjacentHTML('beforeend', html);
  }

  function handleAddFreeBuiltinModule() {
    var list = document.getElementById('we-free-modules-list');
    var sel = document.getElementById('we-free-builtin-select');
    if (!list || !sel || !sel.value) return;
    var count = list.querySelectorAll('.we-free-module-card').length;
    if (list.querySelector('.we-empty')) list.innerHTML = '';
    list.insertAdjacentHTML('beforeend', buildFreeModuleCardHTML(cloneBuiltinModuleRef(sel.value, count + 1), count));
  }

  function handleSaveFreeModules() {
    var P = getPresets();
    if (!P) return;
    var preset = ensureCustomPresetForEdit(P.getActivePreset(), '已创建自定义副本用于编辑自由模块');
    if (!preset) return;
    var collected = collectFreeModulesFromForm();
    if (collected.errors.length) { toastError(collected.errors[0]); return; }
    preset.mode = 'free';
    preset.modules = collected.modules;
    savePresetAfterFreeEdit(preset, '自由模块已保存');
  }

  function moveFreeModuleCard(button, dir) {
    var card = button && button.closest('.we-free-module-card');
    if (!card || !card.parentNode) return;
    if (dir < 0 && card.previousElementSibling) card.parentNode.insertBefore(card, card.previousElementSibling);
    if (dir > 0 && card.nextElementSibling) card.parentNode.insertBefore(card.nextElementSibling, card);
  }

  function applyMechanicsTemplate(button) {
    var key = button && button.getAttribute('data-we-mech-template');
    var card = button && button.closest('.we-free-module-card');
    if (!key || !card) return;
    var templates = {
      dice: { mode: 'threshold', defaultBase: 85, setbackRatio: 0.4 },
      stages: { states: ['萌芽', '推进', '完成'], progressField: 'progress', progressMax: 3 },
      verdicts: { axes: ['status'], levels: ['低', '中', '高'] }
    };
    var textarea = card.querySelector('.we-free-mech-json[data-mech="' + key + '"]');
    var checkbox = card.querySelector('.we-free-mech-enabled[data-mech="' + key + '"]');
    if (textarea) textarea.value = JSON.stringify(templates[key], null, 2);
    if (checkbox) checkbox.checked = true;
  }
  function handleSaveModules() {
    var P = getPresets();
    if (!P) return;
    var checkboxes = document.querySelectorAll('.we-module-toggle-cb');
    if (!checkboxes.length) return;
    var disabled = [];
    for (var i = 0; i < checkboxes.length; i++) {
      if (!checkboxes[i].checked) disabled.push(checkboxes[i].getAttribute('data-module-id'));
    }
    var preset = P.getActivePreset();
    if (preset.builtin) {
      var copy = deepClone(preset);
      copy.id = generateId();
      copy.name = preset.name + ' (custom)';
      copy.builtin = false;
      copy.disabledModules = disabled;
      P.saveCustomPreset(copy);
      P.setActivePreset(copy.id);
      toast('已创建自定义副本并保存模块设置：' + copy.name);
      refreshPresetSection();
    } else {
      preset.disabledModules = disabled;
      P.saveCustomPreset(preset);
      toast('模块设置已保存');
    }
    if (window.WORLD_ENGINE_UI && typeof window.WORLD_ENGINE_UI.refresh === 'function') {
      window.WORLD_ENGINE_UI.refresh(false);
    }
  }

  function parseSchemaExampleValue(text) {
    var raw = (text || '').trim();
    if (!raw) return undefined;
    try { return JSON.parse(raw); } catch (err) { return raw; }
  }

  function buildSchemaFieldSpecFromRow(row) {
    var typeInput = row.querySelector('.we-schema-field-type');
    var descInput = row.querySelector('.we-schema-field-desc');
    var enumInput = row.querySelector('.we-schema-field-enum');
    var exampleInput = row.querySelector('.we-schema-field-example');
    var displayInput = row.querySelector('.we-schema-field-display');
    var spec = { type: (typeInput && typeInput.value.trim()) || 'string' };
    if (descInput && descInput.value.trim()) spec.description = descInput.value.trim();
    if (enumInput && enumInput.value.trim()) {
      spec.enum = enumInput.value.split(',').map(function (item) { return item.trim(); }).filter(Boolean);
    }
    if (exampleInput) {
      var example = parseSchemaExampleValue(exampleInput.value);
      if (example !== undefined) spec.example = example;
    }
    if (displayInput && !displayInput.checked) spec.display = false;
    return spec;
  }
  function collectSchemaOverridesFromForm() {
    var blocks = document.querySelectorAll('.we-schema-module-block[data-schema-module]');
    var overrides = {};
    for (var i = 0; i < blocks.length; i++) {
      var moduleId = blocks[i].getAttribute('data-schema-module');
      if (!moduleId) continue;
      var hiddenFields = [];
      var overrideFields = {};
      var addFields = {};
      var existingRows = blocks[i].querySelectorAll('.we-schema-row[data-schema-existing="1"]');
      for (var er = 0; er < existingRows.length; er++) {
        var existingName = existingRows[er].getAttribute('data-schema-field');
        if (!existingName) continue;
        var hiddenInput = existingRows[er].querySelector('.we-schema-field-hidden');
        if (hiddenInput && hiddenInput.checked) {
          hiddenFields.push(existingName);
          continue;
        }
        overrideFields[existingName] = buildSchemaFieldSpecFromRow(existingRows[er]);
      }
      var newRows = blocks[i].querySelectorAll('.we-schema-row[data-schema-new="1"]');
      for (var nr = 0; nr < newRows.length; nr++) {
        var nameInput = newRows[nr].querySelector('.we-schema-field-name');
        var newName = nameInput ? nameInput.value.trim() : '';
        if (!newName) continue;
        addFields[newName] = buildSchemaFieldSpecFromRow(newRows[nr]);
      }
      var entry = {};
      if (Object.keys(overrideFields).length) entry.overrideFields = overrideFields;
      if (Object.keys(addFields).length) entry.addFields = addFields;
      if (hiddenFields.length) entry.hiddenFields = hiddenFields;
      if (Object.keys(entry).length) overrides[moduleId] = entry;
    }
    return overrides;
  }

  function saveSchemaOverridesObject(parsed, sourceLabel) {
    var P = getPresets();
    if (!P) return;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      toastError('schemaOverrides 必须是对象');
      return;
    }
    var preset = P.getActivePreset();
    if (preset.builtin) {
      var copy = deepClone(preset);
      copy.id = generateId();
      copy.name = preset.name + ' (custom)';
      copy.builtin = false;
      copy.schemaOverrides = parsed;
      P.saveCustomPreset(copy);
      P.setActivePreset(copy.id);
      toast('已创建自定义副本并保存输出结构：' + copy.name);
      refreshPresetSection();
    } else {
      preset.schemaOverrides = parsed;
      P.saveCustomPreset(preset);
      toast(sourceLabel || '输出结构已保存');
      refreshPresetSection();
    }
    if (window.WORLD_ENGINE_UI && typeof window.WORLD_ENGINE_UI.refresh === 'function') {
      window.WORLD_ENGINE_UI.refresh(false);
    }
  }

  function handleSaveSchemaOverrides() {
    var issues = validateSchemaFormIssues();
    if (issues.errors.length) { toastError(issues.errors[0]); return; }
    issues.warnings.forEach(function (w) { toastWarning(w); });
    var parsed = collectSchemaOverridesFromForm();
    var jsonText = JSON.stringify(parsed, null, 2);
    var textarea = document.getElementById('we-preset-schema-overrides');
    if (textarea) textarea.value = jsonText;
    showSchemaPreviewConfirm(jsonText).then(function (ok) {
      if (ok) saveSchemaOverridesObject(parsed, '表单结构已保存');
    });
  }

  function handleSaveSchemaOverridesJson() {
    var textarea = document.getElementById('we-preset-schema-overrides');
    if (!textarea) return;
    var parsed;
    try {
      parsed = JSON.parse(textarea.value || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('schemaOverrides 必须是对象');
    } catch (err) {
      toastError('输出结构 JSON 解析失败：' + formatJsonParseError(textarea.value || '', err));
      return;
    }
    saveSchemaOverridesObject(parsed, '高级 JSON 结构已保存');
  }
  function handleAddTerm() {
    var tbody = document.getElementById('we-term-table-body');
    if (!tbody) return;

    var rowCount = tbody.querySelectorAll('tr[data-we-term-idx]').length;
    var newIdx = rowCount;
    var tr = document.createElement('tr');
    tr.setAttribute('data-we-term-idx', newIdx);
    tr.innerHTML =
      '<td><input type="text" class="we-term-key" value="" placeholder="原始术语"></td>' +
      '<td><input type="text" class="we-term-val" value="" placeholder="替换为"></td>' +
      '<td style="width:30px;text-align:center;"><span class="we-term-delete-btn" data-we-term-delete="' + newIdx + '" title="删除此条">&#10005;</span></td>';
    tbody.appendChild(tr);
  }

  // ── Handler: Delete Term ──
  function handleDeleteTerm(idx) {
    var tbody = document.getElementById('we-term-table-body');
    if (!tbody) return;

    var row = tbody.querySelector('tr[data-we-term-idx="' + idx + '"]');
    if (row && row.parentNode) {
      row.parentNode.removeChild(row);
    }
  }

  // ── Handler: Save Term Map ──
  function handleSaveTermMap() {
    var P = getPresets();
    if (!P) return;

    var tbody = document.getElementById('we-term-table-body');
    if (!tbody) return;

    var rows = tbody.querySelectorAll('tr[data-we-term-idx]');
    var newMap = {};
    for (var i = 0; i < rows.length; i++) {
      var keyInput = rows[i].querySelector('.we-term-key');
      var valInput = rows[i].querySelector('.we-term-val');
      if (keyInput && valInput) {
        var key = keyInput.value.trim();
        var val = valInput.value.trim();
        if (key) {
          newMap[key] = val;
        }
      }
    }

    var preset = P.getActivePreset();
    if (preset.builtin) {
      toastWarning('内置预设不可修改术语表');
      return;
    }

    preset.termMap = newMap;
    P.saveCustomPreset(preset);
    toast('术语表已保存 (' + Object.keys(newMap).length + '条)');
    refreshPresetSection();
  }

  // ── Handler: Save Preset Details ──
  function handleSaveDetails() {
    var P = getPresets();
    if (!P) return;

    var preset = P.getActivePreset();
    if (preset.builtin) {
      toastWarning('无法编辑内置预设的详情');
      return;
    }

    // Basic info
    var nameInput = document.getElementById('we-detail-name');
    var descInput = document.getElementById('we-detail-description');
    if (nameInput) preset.name = nameInput.value.trim() || preset.name;
    if (descInput) preset.description = descInput.value.trim();

    // ── Reputation ──
    var dimKeys = ['authority', 'common', 'shadow', 'circuit'];
    if (!preset.reputation) preset.reputation = {};
    if (!preset.reputation.dimensions) preset.reputation.dimensions = {};

    for (var di = 0; di < dimKeys.length; di++) {
      var dk = dimKeys[di];
      if (!preset.reputation.dimensions[dk]) preset.reputation.dimensions[dk] = {};
      var nameEl = document.querySelector('[data-we-rep-dim="' + dk + '"][data-we-rep-field="name"]');
      var descEl = document.querySelector('[data-we-rep-dim="' + dk + '"][data-we-rep-field="description"]');
      if (nameEl) preset.reputation.dimensions[dk].name = nameEl.value.trim();
      if (descEl) preset.reputation.dimensions[dk].description = descEl.value.trim();
    }

    // Reputation levels
    var newLevels = [];
    var levelInputs = document.querySelectorAll('[data-we-rep-level]');
    for (var li = 0; li < levelInputs.length; li++) {
      var lv = levelInputs[li].value.trim();
      if (lv) newLevels.push(lv);
    }
    if (newLevels.length > 0) preset.reputation.levels = newLevels;

    // Reputation verdicts
    if (!preset.reputation.verdicts) preset.reputation.verdicts = {};
    for (var vdi = 0; vdi < dimKeys.length; vdi++) {
      var vdk = dimKeys[vdi];
      var verdictEls = document.querySelectorAll('[data-we-rep-verdict-dim="' + vdk + '"]');
      if (verdictEls.length > 0) {
        preset.reputation.verdicts[vdk] = {};
        for (var vi = 0; vi < verdictEls.length; vi++) {
          var lvlName = verdictEls[vi].getAttribute('data-we-rep-verdict-level');
          preset.reputation.verdicts[vdk][lvlName] = verdictEls[vi].value.trim();
        }
      }
    }

    // ── Factions ──
    if (!preset.factions) preset.factions = {};

    // Statuses
    var statusInputs = document.querySelectorAll('[data-we-fac-status]');
    var newStatuses = [];
    for (var si = 0; si < statusInputs.length; si++) {
      var sv = statusInputs[si].value.trim();
      if (sv) newStatuses.push(sv);
    }
    if (newStatuses.length > 0) preset.factions.statuses = newStatuses;

    // Status verdicts
    var statusVerdictEls = document.querySelectorAll('[data-we-fac-status-verdict]');
    preset.factions.statusVerdicts = {};
    for (var svi = 0; svi < statusVerdictEls.length; svi++) {
      var stKey = statusVerdictEls[svi].getAttribute('data-we-fac-status-verdict');
      preset.factions.statusVerdicts[stKey] = statusVerdictEls[svi].value.trim();
    }

    // Relations
    var relationInputs = document.querySelectorAll('[data-we-fac-relation]');
    var newRelations = [];
    for (var ri = 0; ri < relationInputs.length; ri++) {
      var rv = relationInputs[ri].value.trim();
      if (rv) newRelations.push(rv);
    }
    if (newRelations.length > 0) preset.factions.relations = newRelations;

    // Relation verdicts
    var relVerdictEls = document.querySelectorAll('[data-we-fac-relation-verdict]');
    preset.factions.relationVerdicts = {};
    for (var rvi = 0; rvi < relVerdictEls.length; rvi++) {
      var relKey = relVerdictEls[rvi].getAttribute('data-we-fac-relation-verdict');
      preset.factions.relationVerdicts[relKey] = relVerdictEls[rvi].value.trim();
    }

    // ── Economy ──
    if (!preset.economy) preset.economy = {};

    var climateInputs = document.querySelectorAll('[data-we-eco-climate]');
    var newClimates = [];
    for (var ci = 0; ci < climateInputs.length; ci++) {
      var cv = climateInputs[ci].value.trim();
      if (cv) newClimates.push(cv);
    }
    if (newClimates.length > 0) preset.economy.climates = newClimates;

    var climVerdictEls = document.querySelectorAll('[data-we-eco-climate-verdict]');
    preset.economy.climateVerdicts = {};
    for (var cvi = 0; cvi < climVerdictEls.length; cvi++) {
      var climKey = climVerdictEls[cvi].getAttribute('data-we-eco-climate-verdict');
      preset.economy.climateVerdicts[climKey] = climVerdictEls[cvi].value.trim();
    }

    // ── Regional Incidents ──
    if (!preset.regionalIncidents) preset.regionalIncidents = {};

    var chanceEl = document.getElementById('we-inc-chance');
    var durationEl = document.getElementById('we-inc-duration');
    var cooldownEl = document.getElementById('we-inc-cooldown');
    if (chanceEl) preset.regionalIncidents.chance = parseFloat(chanceEl.value) || 0.03;
    if (durationEl) preset.regionalIncidents.durationRounds = parseInt(durationEl.value, 10) || 5;
    if (cooldownEl) preset.regionalIncidents.cooldownRounds = parseInt(cooldownEl.value, 10) || 5;

    // Incident types
    var incidentCards = document.querySelectorAll('[data-we-inc-idx]');
    var newTypes = [];
    for (var ii = 0; ii < incidentCards.length; ii++) {
      var idx = incidentCards[ii].getAttribute('data-we-inc-idx');
      var typeEl = document.querySelector('[data-we-inc-type="' + idx + '"]');
      var labelEl = document.querySelector('[data-we-inc-label="' + idx + '"]');
      var weightEl = document.querySelector('[data-we-inc-weight="' + idx + '"]');
      var guideEl = document.querySelector('[data-we-inc-guide="' + idx + '"]');
      newTypes.push({
        type: typeEl ? typeEl.value.trim() : '',
        label: labelEl ? labelEl.value.trim() : '',
        weight: weightEl ? (parseInt(weightEl.value, 10) || 0) : 0,
        guide: guideEl ? guideEl.value.trim() : ''
      });
    }
    preset.regionalIncidents.types = newTypes;

    // Save
    P.saveCustomPreset(preset);
    toast('预设详情已保存: ' + preset.name);
    refreshPresetSection();
  }

  // ── Handler: Delete Preset ──
  async function handleDeletePreset() {
    var P = getPresets();
    if (!P) return;

    var preset = P.getActivePreset();
    if (preset.builtin) {
      toastWarning('无法删除内置预设');
      return;
    }

    var confirmed = await showConfirm('确认要删除预设 "' + preset.name + '" 吗？此操作不可撤销。');
    if (!confirmed) return;

    if (P.deleteCustomPreset(preset.id)) {
      toast('已删除预设: ' + preset.name);
      refreshPresetSection();
      if (window.WORLD_ENGINE_UI && typeof window.WORLD_ENGINE_UI.refresh === 'function') {
        window.WORLD_ENGINE_UI.refresh(false);
      }
    } else {
      toastError('删除失败');
    }
  }

  // ── Handler: Faction Add/Delete Status ──
  function handleFacAddStatus() {
    // Re-read current detail section to add a new status row
    var container = document.querySelector('[data-we-fac-add-status]');
    if (!container) return;
    var parent = container.parentNode;
    var newRow = document.createElement('div');
    newRow.className = 'we-detail-item-row';
    var count = parent.querySelectorAll('[data-we-fac-status]').length;
    newRow.innerHTML =
      '<input type="text" data-we-fac-status="' + count + '" value="" placeholder="新状态">' +
      '<span class="we-detail-item-delete" data-we-fac-status-del="' + count + '" title="删除">&#10005;</span>';
    parent.insertBefore(newRow, container);
  }

  function handleFacDeleteStatus(idx) {
    var input = document.querySelector('[data-we-fac-status="' + idx + '"]');
    if (input) {
      var row = input.closest('.we-detail-item-row');
      if (row && row.parentNode) row.parentNode.removeChild(row);
    }
  }

  // ── Handler: Faction Add/Delete Relation ──
  function handleFacAddRelation() {
    var container = document.querySelector('[data-we-fac-add-relation]');
    if (!container) return;
    var parent = container.parentNode;
    var newRow = document.createElement('div');
    newRow.className = 'we-detail-item-row';
    var count = parent.querySelectorAll('[data-we-fac-relation]').length;
    newRow.innerHTML =
      '<input type="text" data-we-fac-relation="' + count + '" value="" placeholder="新关系">' +
      '<span class="we-detail-item-delete" data-we-fac-relation-del="' + count + '" title="删除">&#10005;</span>';
    parent.insertBefore(newRow, container);
  }

  function handleFacDeleteRelation(idx) {
    var input = document.querySelector('[data-we-fac-relation="' + idx + '"]');
    if (input) {
      var row = input.closest('.we-detail-item-row');
      if (row && row.parentNode) row.parentNode.removeChild(row);
    }
  }

  // ── Handler: Economy Add/Delete Climate ──
  function handleEcoAddClimate() {
    var container = document.querySelector('[data-we-eco-add-climate]');
    if (!container) return;
    var parent = container.parentNode;
    var newRow = document.createElement('div');
    newRow.className = 'we-detail-item-row';
    var count = parent.querySelectorAll('[data-we-eco-climate]').length;
    newRow.innerHTML =
      '<input type="text" data-we-eco-climate="' + count + '" value="" placeholder="新经济状态">' +
      '<span class="we-detail-item-delete" data-we-eco-climate-del="' + count + '" title="删除">&#10005;</span>';
    parent.insertBefore(newRow, container);
  }

  function handleEcoDeleteClimate(idx) {
    var input = document.querySelector('[data-we-eco-climate="' + idx + '"]');
    if (input) {
      var row = input.closest('.we-detail-item-row');
      if (row && row.parentNode) row.parentNode.removeChild(row);
    }
  }

  // ── Handler: Incident Add/Delete ──
  function handleIncidentAdd() {
    var addBtn = document.getElementById('we-inc-add');
    if (!addBtn) return;
    var parent = addBtn.parentNode;
    var count = parent.querySelectorAll('[data-we-inc-idx]').length;
    var card = document.createElement('div');
    card.className = 'we-incident-card';
    card.setAttribute('data-we-inc-idx', count);
    card.innerHTML =
      '<div class="we-incident-card-header">' +
        '<span>#' + (count + 1) + '</span>' +
        '<span class="we-detail-item-delete" data-we-inc-del="' + count + '" title="删除此事件">&#10005;</span>' +
      '</div>' +
      '<div class="we-detail-field">' +
        '<label>类型标识 (英文)</label>' +
        '<input type="text" data-we-inc-type="' + count + '" value="" placeholder="event_type">' +
      '</div>' +
      '<div class="we-detail-field">' +
        '<label>显示名称</label>' +
        '<input type="text" data-we-inc-label="' + count + '" value="" placeholder="事件名称">' +
      '</div>' +
      '<div class="we-detail-field">' +
        '<label>权重 (数值)</label>' +
        '<input type="number" data-we-inc-weight="' + count + '" value="10" min="0" max="100">' +
      '</div>' +
      '<div class="we-detail-field">' +
        '<label>事件描述</label>' +
        '<textarea data-we-inc-guide="' + count + '" style="min-height:50px;" placeholder="描述该事件的详细场景..."></textarea>' +
      '</div>';
    parent.insertBefore(card, addBtn);
  }

  function handleIncidentDelete(idx) {
    var card = document.querySelector('.we-incident-card[data-we-inc-idx="' + idx + '"]');
    if (card && card.parentNode) card.parentNode.removeChild(card);
  }

  // ─────────────────────────────────────────────
  // Init
  // ─────────────────────────────────────────────
  function init() {
    injectStyles();

    // Watch for settings view to appear
    _observer = new MutationObserver(function () {
      tryInjectPresetUI();
    });

    var panel = document.getElementById('we-panel-body');
    if (panel) {
      _observer.observe(panel, { childList: true, subtree: true });
      tryInjectPresetUI();
    } else {
      // Panel not built yet, retry
      var interval = setInterval(function () {
        var p = document.getElementById('we-panel-body');
        if (p) {
          clearInterval(interval);
          _observer.observe(p, { childList: true, subtree: true });
          tryInjectPresetUI();
        }
      }, 1000);
    }

    // Event delegation on document
    document.addEventListener('click', handleClick);
    document.addEventListener('change', handleChange);

    console.log('[WorldEngine PresetUI] Module initialized');
  }

  // ─────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────
  return {
    init: init,
    renderSettingsSection: function () {
      injectStyles();
      return '<div id="we-preset-section">' + buildPresetHTML() + '</div>';
    },
    refresh: refreshPresetSection
  };
})();
