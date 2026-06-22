const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const mem = {};

globalThis.window = {
  WORLD_ENGINE_STORE: {
    getItem: (key) => Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null,
    setItem: (key, value) => { mem[key] = String(value); },
    removeItem: (key) => { delete mem[key]; },
    keys: () => Object.keys(mem)
  }
};
globalThis.window.window = globalThis.window;
globalThis.window.console = console;
globalThis.window.Date = Date;
globalThis.document = { addEventListener: () => {} };

eval.call(globalThis.window, fs.readFileSync(path.join(root, 'world-engine-presets.js'), 'utf8'));

const P = window.WORLD_ENGINE_PRESETS;
const classic = P.normalizePreset({ id: 'classic_test', name: 'Classic Test' });
assert.strictEqual(classic.mode, 'classic');
assert.deepStrictEqual(classic.modules, []);

const mixed = P.normalizePreset({
  id: 'mixed_test',
  name: 'Mixed Test',
  mode: 'free',
  modules: [
    { id: 'events', kind: 'builtin', order: 20 },
    {
      id: 'cultivation',
      name: '修为',
      kind: 'custom',
      order: 10,
      container: 'array',
      field: 'cultivation',
      itemKey: 'name',
      rules: '<cultivation>追踪修为。</cultivation>',
      fields: {
        name: { type: 'string', label: '姓名', example: '青岚' },
        realm: { type: 'enum', label: '境界', enum: ['炼气', '筑基'], example: '筑基' }
      },
      display: { style: 'cards', titleField: 'name', badgeFields: ['realm'] }
    },
    {
      id: 'sectLedger',
      name: '宗门账',
      kind: 'custom',
      order: 30,
      container: 'object',
      field: 'sectLedger',
      fields: { balance: { type: 'number', label: '结余', example: 7 } },
      display: { style: 'keyvalue' }
    },
    { id: 'badEvents', name: 'Bad Events', kind: 'custom', order: 40, container: 'array', field: 'events' },
    { id: 'cultivation', kind: 'custom', order: 50, container: 'array' }
  ]
});
assert.strictEqual(mixed.mode, 'free');
assert.strictEqual(mixed.modules.length, 4, 'normalize should remove duplicate module ids');
assert.strictEqual(mixed.modules[0].kind, 'builtin');
assert.strictEqual(mixed.modules[1].field, 'cultivation');

window.WORLD_ENGINE_PRESETS.getActivePreset = () => mixed;
window.WORLD_ENGINE_PRESETS.applyTermMap = (text) => text;
window.WORLD_ENGINE_PRESETS.uiModuleLabel = () => '';
eval(fs.readFileSync(path.join(root, 'world-engine-rules-loader.js'), 'utf8'));

const R = window.WORLD_ENGINE_RULES;
const active = R.getActiveModuleDescriptors();
assert.deepStrictEqual(active.map(d => d.id), ['events', 'cultivation', 'sectLedger']);
assert.strictEqual(active.find(d => d.id === 'events').kind, 'builtin');
assert.strictEqual(active.find(d => d.id === 'cultivation').kind, 'custom');
assert(R.getActiveModuleDescriptorWarnings().some(w => w.includes('events')), 'field collision should be warned and skipped');
assert.deepStrictEqual(R.getActiveOutputSchemas().map(s => s.field), ['cultivation', 'events', 'sectLedger']);

const rulesText = R.getAllRulesText();
assert(rulesText.includes('模块二：事件链') || rulesText.includes('conflict'), 'builtin referenced module should reuse built-in rules');
assert(rulesText.includes('<cultivation>'), 'custom module rules should be injected');
assert(!rulesText.includes('Bad Events'), 'field-colliding custom module should be skipped');

const state = {
  round: 0,
  worldDigest: '',
  events: [],
  factions: [],
  worldTrends: [],
  winds: [],
  economy: { climate: '平稳', signals: [] },
  reputation: {},
  enemies: [],
  influenceChain: [],
  regionalIncident: { active: false, cooldown: 0, duration: 0 },
  blackbox: { secretActions: [], secretAssets: [] },
  memories: []
};

window.WORLD_ENGINE_CORE = {
  hasState: () => false,
  isNewRound: () => true,
  restoreCheckpoint: () => null,
  saveCheckpoint: () => {},
  saveFingerprint: () => {},
  getChatFingerprint: () => 'fp',
  saveStateWithLayer: (s) => { window.__savedState = JSON.parse(JSON.stringify(s)); },
  saveState: (s) => { window.__savedState = JSON.parse(JSON.stringify(s)); },
  addEvent: (s, ev) => { s.events.push(ev); },
  addFaction: (s, fac) => { s.factions.push(fac); },
  addWorldTrend: (s, trend) => { s.worldTrends.push(trend); },
  addWind: (s, wind) => { s.winds.push(wind); },
  ensureEventFields: (ev) => ev,
  getUserPersona: () => '',
  renderUserName: (text) => text,
  loadState: () => state
};
window.WORLD_ENGINE_API = {
  callApi: async () => JSON.stringify({
    world_digest: '修为开始流动。',
    cultivation: [{ name: '青岚', realm: '筑基' }],
    sectLedger: { balance: 7 }
  }),
  parseJSON: JSON.parse
};

eval(fs.readFileSync(path.join(root, 'world-engine-evolution.js'), 'utf8'));

(async () => {
  const ok = await window.WORLD_ENGINE_EVOLUTION.evolve(state, 'user', 'ai', { mode: 'forward' });
  assert.strictEqual(ok, true);
  assert.deepStrictEqual(state.cultivation, [{ name: '青岚', realm: '筑基' }]);
  assert.deepStrictEqual(state.sectLedger, { balance: 7 });

  eval(fs.readFileSync(path.join(root, 'world-engine-ui.js'), 'utf8'));
  const html = window.WORLD_ENGINE_UI.__test.renderHomeViewExpanded(state, 0, 'state');
  assert(html.includes('修为'));
  assert(html.includes('青岚'));
  assert(html.includes('宗门账'));
  assert(html.includes('7'));
  console.log('Phase 4 mixed mode tests: 12 passed');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
