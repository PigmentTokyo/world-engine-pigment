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

  // Collapsible section state (persisted in memory only)
  var _collapsed = {
    rules: true,
    moduleToggles: true,
    schemaOverrides: true,
    termMap: true,
    details: true
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
      '  background: rgba(0,0,0,0.6);',
      '  z-index: 99999;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '}',
      '.we-confirm-box {',
      '  background: var(--we-bg1, #151520);',
      '  border: 1px solid var(--we-border, #333);',
      '  border-radius: 8px;',
      '  padding: 20px 24px;',
      '  max-width: 360px;',
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

  /**
   * Show a confirmation dialog. Returns a promise that resolves true/false.
   */
  function showConfirm(message) {
    return new Promise(function (resolve) {
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

  // ─────────────────────────────────────────────
  // Section 1: 世界观预设 (Preset Selector)
  // ─────────────────────────────────────────────
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
        '<div class="we-preset-actions">' +
          '<button class="we-btn we-btn-primary" id="we-preset-apply">应用</button>' +
          '<button class="we-btn" id="we-preset-generate"' + (_generating ? ' disabled' : '') + '>从世界书生成</button>' +
          '<button class="we-btn" id="we-preset-import">导入预设</button>' +
          '<button class="we-btn" id="we-preset-export">导出当前预设</button>' +
          (activePreset.builtin ? '' : '<button class="we-btn we-btn-danger" id="we-preset-delete">删除当前预设</button>') +
        '</div>' +
        (_generating
          ? '<div class="we-preset-generating"><div class="we-spinner"></div>正在从世界书生成预设，请稍候...</div>'
          : '') +
        '<input type="file" id="we-preset-file-input" accept=".json">' +
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

    var rows = '';
    for (var i = 0; i < modules.length; i++) {
      var m = modules[i];
      var checked = disabled.indexOf(m.moduleId) === -1;
      rows +=
        '<label class="we-module-toggle-row" style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;">' +
          '<input type="checkbox" class="we-module-toggle-cb" data-module-id="' + esc(m.moduleId) + '"' + (checked ? ' checked' : '') + '>' +
          '<span style="' + (checked ? '' : 'opacity:0.5;text-decoration:line-through;') + '">' + esc(m.comment || m.moduleId) + '</span>' +
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
    var gridStyle = 'display:grid;grid-template-columns:1fr 100px 1.4fr 1fr 1fr 54px 54px;gap:6px;align-items:center;';
    var builtinNote = isBuiltin
      ? '<div class="we-hint" style="margin-bottom:6px;color:var(--we-warning,#fdcb6e);">当前为内置预设，保存后会自动创建自定义副本。</div>'
      : '';

    function newFieldRowHTML(moduleId) {
      return '' +
        '<div class="we-schema-row we-schema-new-row" data-schema-new="1" data-schema-module="' + esc(moduleId) + '" style="' + gridStyle + 'margin-top:8px;">' +
          '<input class="we-schema-field-name" type="text" value="" placeholder="字段名，例如 resources">' +
          '<input class="we-schema-field-type" type="text" value="string">' +
          '<input class="we-schema-field-desc" type="text" value="" placeholder="字段说明">' +
          '<input class="we-schema-field-enum" type="text" value="" placeholder="枚举，可空">' +
          '<input class="we-schema-field-example" type="text" value="" placeholder="示例，可空">' +
          '<label style="display:flex;gap:4px;align-items:center;font-size:11px;"><input class="we-schema-field-display" type="checkbox" checked>显示</label>' +
          '<button class="we-icon-btn we-schema-row-remove" type="button" title="删除字段行" style="width:28px;height:28px;">×</button>' +
        '</div>';
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
        var hiddenMap = {};
        if (Array.isArray(moduleOverride.hiddenFields)) {
          moduleOverride.hiddenFields.map(String).forEach(function (field) { hiddenMap[field] = true; });
        }
        var overrideFields = moduleOverride.overrideFields || {};
        var addFields = moduleOverride.addFields || {};
        var fields = Object.keys(baseSchema.fields);
        var rows = '';
        for (var fi = 0; fi < fields.length; fi++) {
          var field = fields[fi];
          var spec = Object.assign({}, baseSchema.fields[field] || {}, overrideFields[field] || {}, mergedSchema.fields[field] || {});
          var enumText = Array.isArray(spec.enum) ? spec.enum.join(', ') : '';
          var exampleText = spec.example === undefined ? '' : JSON.stringify(spec.example);
          rows += '' +
            '<div class="we-schema-row" data-schema-existing="1" data-schema-module="' + esc(mod.moduleId) + '" data-schema-field="' + esc(field) + '" style="' + gridStyle + 'margin-bottom:6px;">' +
              '<input class="we-schema-field-name" type="text" value="' + esc(field) + '" readonly title="基础字段不能直接重命名；可先隐藏，再新增一个字段。">' +
              '<input class="we-schema-field-type" type="text" value="' + esc(spec.type || 'string') + '">' +
              '<input class="we-schema-field-desc" type="text" value="' + esc(spec.description || '') + '">' +
              '<input class="we-schema-field-enum" type="text" value="' + esc(enumText) + '" placeholder="a, b, c">' +
              '<input class="we-schema-field-example" type="text" value="' + esc(exampleText) + '" placeholder="示例">' +
              '<label style="display:flex;gap:4px;align-items:center;font-size:11px;"><input class="we-schema-field-display" type="checkbox"' + (spec.display === false ? '' : ' checked') + '>显示</label>' +
              '<label style="display:flex;gap:4px;align-items:center;font-size:11px;"><input class="we-schema-field-hidden" type="checkbox"' + (hiddenMap[field] ? ' checked' : '') + '>隐藏</label>' +
            '</div>';
        }
        Object.keys(addFields).forEach(function (field) {
          var spec = addFields[field] || {};
          var enumText = Array.isArray(spec.enum) ? spec.enum.join(', ') : '';
          var exampleText = spec.example === undefined ? '' : JSON.stringify(spec.example);
          rows += '' +
            '<div class="we-schema-row we-schema-new-row" data-schema-new="1" data-schema-module="' + esc(mod.moduleId) + '" style="' + gridStyle + 'margin-top:8px;">' +
              '<input class="we-schema-field-name" type="text" value="' + esc(field) + '" placeholder="字段名，例如 resources">' +
              '<input class="we-schema-field-type" type="text" value="' + esc(spec.type || 'string') + '">' +
              '<input class="we-schema-field-desc" type="text" value="' + esc(spec.description || '') + '" placeholder="字段说明">' +
              '<input class="we-schema-field-enum" type="text" value="' + esc(enumText) + '" placeholder="枚举，可空">' +
              '<input class="we-schema-field-example" type="text" value="' + esc(exampleText) + '" placeholder="示例，可空">' +
              '<label style="display:flex;gap:4px;align-items:center;font-size:11px;"><input class="we-schema-field-display" type="checkbox"' + (spec.display === false ? '' : ' checked') + '>显示</label>' +
              '<button class="we-icon-btn we-schema-row-remove" type="button" title="删除字段行" style="width:28px;height:28px;">×</button>' +
            '</div>';
        });
        rows += newFieldRowHTML(mod.moduleId);

        schemaBlocks += '' +
          '<div class="we-schema-module-block" data-schema-module="' + esc(mod.moduleId) + '" style="border:1px solid var(--we-border,#333);border-radius:6px;padding:8px;margin:8px 0;">' +
            '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:6px;">' +
              '<strong>' + esc(mod.comment || mod.moduleId) + '</strong>' +
              '<span class="we-hint" style="margin:0;">' + esc(baseSchema.field || mod.moduleId) + '</span>' +
            '</div>' +
            '<div style="' + gridStyle + 'font-size:11px;color:var(--we-text3,#888);margin-bottom:4px;">' +
              '<span>字段</span><span>类型</span><span>说明</span><span>枚举</span><span>示例</span><span>显示</span><span>隐藏</span>' +
            '</div>' + rows +
            '<button class="we-btn we-schema-add-field" type="button" data-we-schema-add-field="' + esc(mod.moduleId) + '" style="margin-top:8px;">新增字段</button>' +
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

    // ── Sub-section: 声誉系统 ──
    var reputationHTML = buildReputationEditor(preset);
    // ── Sub-section: 势力系统 ──
    var factionHTML = buildFactionEditor(preset);
    // ── Sub-section: 经济系统 ──
    var economyHTML = buildEconomyEditor(preset);
    // ── Sub-section: 突发事件 ──
    var incidentHTML = buildIncidentEditor(preset);

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
      buildRulesEditorHTML() +
      buildModuleTogglesHTML() +
      buildSchemaOverridesHTML() +
      buildTermMapHTML() +
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

    _generating = true;
    var genBtn = document.getElementById('we-preset-generate');
    if (genBtn) genBtn.disabled = true;

    // Show loading indicator
    refreshPresetSection();

    try {
      var newPreset = await P.generateFromWorldbook();
      if (newPreset) {
        // Switch to the newly generated preset
        P.setActivePreset(newPreset.id);
        toast('已从世界书生成预设: ' + newPreset.name);
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
    var div = document.createElement('div');
    div.className = 'we-schema-row we-schema-new-row';
    div.setAttribute('data-schema-new', '1');
    div.setAttribute('data-schema-module', moduleId || '');
    div.style.cssText = 'display:grid;grid-template-columns:1fr 100px 1.4fr 1fr 1fr 54px 54px;gap:6px;align-items:center;margin-top:8px;';
    div.innerHTML =
      '<input class="we-schema-field-name" type="text" value="" placeholder="字段名，例如 resources">' +
      '<input class="we-schema-field-type" type="text" value="string">' +
      '<input class="we-schema-field-desc" type="text" value="" placeholder="字段说明">' +
      '<input class="we-schema-field-enum" type="text" value="" placeholder="枚举，可空">' +
      '<input class="we-schema-field-example" type="text" value="" placeholder="示例，可空">' +
      '<label style="display:flex;gap:4px;align-items:center;font-size:11px;"><input class="we-schema-field-display" type="checkbox" checked>显示</label>' +
      '<button class="we-icon-btn we-schema-row-remove" type="button" title="删除字段行" style="width:28px;height:28px;">×</button>';
    return div;
  }

  function handleAddSchemaFieldRow(button) {
    var block = button && button.closest('.we-schema-module-block');
    if (!block) return;
    var moduleId = block.getAttribute('data-schema-module') || '';
    block.insertBefore(createSchemaNewRowElement(moduleId), button);
  }

  function handleRemoveSchemaFieldRow(button) {
    var row = button && button.closest('.we-schema-row[data-schema-new="1"]');
    if (row && row.parentNode) row.parentNode.removeChild(row);
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
    var parsed = collectSchemaOverridesFromForm();
    var textarea = document.getElementById('we-preset-schema-overrides');
    if (textarea) textarea.value = JSON.stringify(parsed, null, 2);
    saveSchemaOverridesObject(parsed, '表单结构已保存');
  }

  function handleSaveSchemaOverridesJson() {
    var textarea = document.getElementById('we-preset-schema-overrides');
    if (!textarea) return;
    var parsed;
    try {
      parsed = JSON.parse(textarea.value || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('schemaOverrides 必须是对象');
    } catch (err) {
      toastError('输出结构 JSON 解析失败：' + (err.message || err));
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
