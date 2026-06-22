const assert = require('assert');
const fs = require('fs');
const path = require('path');

const mem = {};
globalThis.localStorage = {
  get length() { return Object.keys(mem).length; },
  key: (i) => Object.keys(mem)[i],
  getItem: (key) => Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null,
  setItem: (key, value) => { mem[key] = String(value); },
  removeItem: (key) => { delete mem[key]; }
};

globalThis.window = {
  SillyTavern: {
    getContext: () => ({ chatId: 'custom-chat', chatMetadata: {}, saveMetadataDebounced: () => {} })
  }
};
globalThis.SillyTavern = globalThis.window.SillyTavern;

const root = path.join(__dirname, '..');
eval(fs.readFileSync(path.join(root, 'world-engine-store.js'), 'utf8'));
eval(fs.readFileSync(path.join(root, 'world-engine-core.js'), 'utf8'));

const descriptors = [
  { id: 'cultivation', kind: 'custom', enabled: true, container: 'array', field: 'cultivation' },
  { id: 'sectLedger', kind: 'custom', enabled: true, container: 'object', field: 'sectLedger' },
  { id: 'moonPhase', kind: 'custom', enabled: true, container: 'scalar', field: 'moonPhase' },
  { id: 'badEvents', kind: 'custom', enabled: true, container: 'array', field: 'events' },
  { id: 'dupA', kind: 'custom', enabled: true, container: 'object', field: 'dupState' },
  { id: 'dupB', kind: 'custom', enabled: true, container: 'object', field: 'dupState' },
  { id: 'bad name', kind: 'custom', enabled: true, container: 'array', field: 'bad-name' }
];

window.WORLD_ENGINE_RULES = {
  getActiveModuleDescriptors: () => descriptors
};

const core = window.WORLD_ENGINE_CORE;
const state = core.loadState();
assert.deepStrictEqual(state.cultivation, []);
assert.deepStrictEqual(state.sectLedger, {});
assert.strictEqual(state.moonPhase, null);
assert.deepStrictEqual(state.dupState, {});
assert.deepStrictEqual(state.events, []);
assert.strictEqual(Object.prototype.hasOwnProperty.call(state, 'bad-name'), false);

const warnings = core.validateCustomModuleStateFields(descriptors);
assert(warnings.some(w => w.includes('events')), 'should warn on built-in state field collision');
assert(warnings.some(w => w.includes('dupState')), 'should warn on duplicate custom state field');
assert(warnings.some(w => w.includes('bad-name')), 'should warn on invalid custom state field');

state.cultivation.push({ name: 'A', realm: 'adept' });
state.sectLedger.balance = 7;
state.moonPhase = 'full';
core.saveState(state);

const customRaw = window.WORLD_ENGINE_STORE.getItem(core.getCustomModuleStateKey('custom-chat'));
const customState = JSON.parse(customRaw);
assert.deepStrictEqual(customState.cultivation, [{ name: 'A', realm: 'adept' }]);
assert.deepStrictEqual(customState.sectLedger, { balance: 7 });
assert.strictEqual(customState.moonPhase, 'full');
assert.strictEqual(Object.prototype.hasOwnProperty.call(customState, 'events'), false);

const mainRaw = window.WORLD_ENGINE_STORE.getItem('world_engine_custom-chat');
const mainState = JSON.parse(mainRaw);
delete mainState.cultivation;
delete mainState.sectLedger;
delete mainState.moonPhase;
window.WORLD_ENGINE_STORE.setItem('world_engine_custom-chat', JSON.stringify(mainState));

const reloaded = core.loadState();
assert.deepStrictEqual(reloaded.cultivation, [{ name: 'A', realm: 'adept' }]);
assert.deepStrictEqual(reloaded.sectLedger, { balance: 7 });
assert.strictEqual(reloaded.moonPhase, 'full');

window.WORLD_ENGINE_STORE.setItem(core.getCustomModuleStateKey('custom-chat'), JSON.stringify({
  cultivation: [{ name: 'B' }],
  orphanModule: [{ name: 'old' }]
}));
const prunedReload = core.loadState();
assert.deepStrictEqual(prunedReload.cultivation, [{ name: 'B' }]);
const prunedRaw = JSON.parse(window.WORLD_ENGINE_STORE.getItem(core.getCustomModuleStateKey('custom-chat')));
assert.deepStrictEqual(Object.keys(prunedRaw), ['cultivation']);

console.log('Custom module state tests: 8 passed');
