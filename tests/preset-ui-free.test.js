const assert = require('assert');
const fs = require('fs');
const path = require('path');

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

globalThis.MutationObserver = function () { this.observe = () => {}; };
globalThis.window = {
  WORLD_ENGINE_STORE: { getItem: () => null, setItem: () => {} },
  WORLD_ENGINE_PRESETS: {
    getAllPresets: () => [{ id: 'free_test', name: 'Free Test', builtin: false }],
    getActivePresetId: () => 'free_test',
    getActivePreset: () => ({
      id: 'free_test',
      name: 'Free Test',
      description: 'Free preset',
      builtin: false,
      mode: 'free',
      customRules: '',
      schemaOverrides: {},
      termMap: {},
      modules: [
        { id: 'events', kind: 'builtin', enabled: true, order: 1 },
        {
          id: 'cultivation',
          name: '修为',
          kind: 'custom',
          enabled: true,
          order: 2,
          container: 'array',
          field: 'cultivation',
          itemKey: 'name',
          rules: '<cultivation>追踪修为。</cultivation>',
          fields: { name: { type: 'string', description: '姓名', example: '青岚' } },
          display: { style: 'cards', titleField: 'name', badgeFields: ['realm'] },
          mechanics: { stages: { states: ['凝气', '破关'], progressField: 'progress', progressMax: 3 } }
        }
      ]
    }),
    setActivePreset: () => true,
    saveCustomPreset: () => true,
    uiModuleLabel: () => '',
    validateSchemaOverrides: () => []
  },
  WORLD_ENGINE_RULES: {
    getModuleList: () => [
      { moduleId: 'events', comment: '事件链' },
      { moduleId: 'winds', comment: '风声' }
    ],
    getBaseModuleOutputSchema: () => null,
    getModuleOutputSchema: () => null
  }
};
globalThis.document = {
  head: { appendChild: () => {} },
  getElementById: () => null,
  addEventListener: () => {},
  createTextNode: (text) => ({ textContent: escapeHtml(text) }),
  createElement: (tag) => ({
    tagName: tag,
    style: {},
    children: [],
    innerHTML: '',
    appendChild(child) { this.children.push(child); this.innerHTML += child.textContent || ''; }
  }),
  querySelector: () => null,
  querySelectorAll: () => []
};

const src = fs.readFileSync(path.join(__dirname, '..', 'world-engine-preset-ui.js'), 'utf8');
eval(src);

const html = window.WORLD_ENGINE_PRESET_UI.renderSettingsSection();
assert(html.includes('name="we-preset-mode" value="free" checked'));
assert(html.includes('id="we-free-add-custom"'));
assert(html.includes('id="we-free-add-builtin"'));
assert(html.includes('id="we-free-save-modules"'));
assert(html.includes('we-free-module-card'));
assert(html.includes('cultivation'));
assert(html.includes('we-free-module-fields'));
assert(html.includes('data-we-mech-template="stages"'));
assert(html.includes('we-free-mech-json'));
assert(src.includes('dice.mode must be threshold, decay, or trigger'));
assert(src.includes('itemKey must match a field'));
assert(src.includes('we-preset-generate-mode'));
assert(src.includes('generationMode: generationMode'));
assert(src.includes('we-preset-generate-auto-crop'));
assert(src.includes('we-preset-generate-count-mode'));
assert(src.includes('moduleCount: moduleCount'));

console.log('Preset UI free editor tests: 16 passed');
