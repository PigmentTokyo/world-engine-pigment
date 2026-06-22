const assert = require('assert');
const fs = require('fs');
const path = require('path');

globalThis.window = {
  WORLD_ENGINE_CORE: {},
  WORLD_ENGINE_API: {},
  WORLD_ENGINE_PRESETS: { getActivePreset: () => ({}) }
};

const src = fs.readFileSync(path.join(__dirname, '..', 'world-engine-evolution.js'), 'utf8');
eval(src);
const GenericMerge = globalThis.window.WORLD_ENGINE_EVOLUTION._GENERIC_MERGE;
assert(GenericMerge && typeof GenericMerge.merge === 'function', 'GenericMerge should be exported for tests');

const state = {
  cultivation: [
    { name: '许青', realm: '炼气', note: '旧备注' }
  ],
  sectLedger: { balance: 10, archive: true },
  moonPhase: '下弦月'
};
const update = {
  cultivation: [
    { name: '许青', realm: '筑基' },
    { name: '阿蛮', realm: '炼气' }
  ],
  sectLedger: { balance: 42 },
  moonPhase: '上弦月',
  disabledBox: { value: 1 }
};

assert.strictEqual(GenericMerge.merge(state, update, {
  id: 'cultivation', field: 'cultivation', container: 'array', itemKey: 'name', enabled: true
}), true);
assert.deepStrictEqual(state.cultivation, [
  { name: '许青', realm: '筑基', note: '旧备注' },
  { name: '阿蛮', realm: '炼气' }
]);

assert.strictEqual(GenericMerge.merge(state, update, {
  id: 'sectLedger', container: 'object', enabled: true
}), true);
assert.deepStrictEqual(state.sectLedger, { balance: 42, archive: true });

assert.strictEqual(GenericMerge.merge(state, update, {
  id: 'moonPhase', container: 'scalar', enabled: true
}), true);
assert.strictEqual(state.moonPhase, '上弦月');

assert.strictEqual(GenericMerge.merge(state, update, {
  id: 'disabledBox', container: 'object', enabled: false
}), false);
assert.strictEqual(state.disabledBox, undefined);

console.log('Generic merge tests: 4 passed');