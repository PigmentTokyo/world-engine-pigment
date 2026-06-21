const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
globalThis.window = {
  WORLD_ENGINE_CORE: {},
  WORLD_ENGINE_API: {}
};

eval.call(globalThis, fs.readFileSync(path.join(root, 'world-engine-evolution.js'), 'utf8'));

const Lifecycle = window.WORLD_ENGINE_EVOLUTION._LIFECYCLE;
const configs = window.WORLD_ENGINE_EVOLUTION._LIFECYCLE_CONFIGS;
assert(Lifecycle && typeof Lifecycle.pruneTerminal === 'function', 'Lifecycle should be exported for tests');
assert(configs && configs.events && configs.influence, 'Lifecycle configs should be exported for tests');

{
  const events = [
    { name: '消散事件', stage: '已消散', level: 1 },
    { name: '失败事件', stage: '已失败', level: 1 },
    { name: '活跃事件', stage: '发酵', level: 1, _terminalSince: 3 }
  ];
  const result = Lifecycle.pruneTerminal(events, configs.events, 10);
  assert.deepStrictEqual(result.removed.map(e => e.name), ['消散事件', '失败事件']);
  assert.deepStrictEqual(result.items.map(e => e.name), ['活跃事件']);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(result.items[0], '_terminalSince'), false);
}

{
  const events = [
    { name: '保留', stage: '已爆发', level: 2, _terminalSince: 5 },
    { name: '到期', stage: '已完成', level: 1, _terminalSince: 5 }
  ];
  const result = Lifecycle.pruneTerminal(events, configs.events, 10);
  assert.deepStrictEqual(result.items.map(e => e.name), ['保留']);
  assert.deepStrictEqual(result.removed.map(e => e.name), ['到期']);
}

{
  const enemies = [{ name: '旧敌', status: '已终结', _terminalSince: 0 }];
  const result = Lifecycle.pruneTerminal(enemies, configs.enemies, 5);
  assert.strictEqual(result.items[0]._terminalSince, 5);
}

{
  const influence = [
    { trigger: '新影响', impact: '仍有效', _createdRound: 4 },
    { trigger: '旧影响', impact: '应过期', _createdRound: 2 },
    null
  ];
  const result = Lifecycle.pruneExpired(influence, configs.influence, 10);
  assert.deepStrictEqual(result.items.map(i => i.trigger), ['新影响']);
  assert.deepStrictEqual(result.removed.map(i => i && i.trigger), ['旧影响', null]);
}

{
  const list = Array.from({ length: 10 }, (_, i) => i);
  Lifecycle.capList(list, 8);
  assert.strictEqual(list.length, 8);
}

{
  const box = {
    secretActions: Array.from({ length: 8 }, (_, i) => ({ action: 'a' + i })),
    secretAssets: Array.from({ length: 7 }, (_, i) => ({ name: 's' + i }))
  };
  Lifecycle.capBlackbox(box, configs.blackbox);
  assert.strictEqual(box.secretActions.length + box.secretAssets.length, 12);
  assert.strictEqual(box.secretActions.length, 5);
  assert.strictEqual(box.secretAssets.length, 7);
}

console.log('Lifecycle tests: 6 passed');
