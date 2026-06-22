const assert = require('assert');
const fs = require('fs');
const path = require('path');

const mem = {};
globalThis.window = {
  WORLD_ENGINE_STORE: {
    getItem: (key) => Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null,
    setItem: (key, value) => { mem[key] = String(value); },
    removeItem: (key) => { delete mem[key]; },
    keys: () => Object.keys(mem)
  },
  WORLD_ENGINE_CORE: {
    getChatId: () => 'worldbook-chat'
  },
  WORLD_ENGINE_API: {
    getSettings: () => ({ worldbookTrigger: true })
  }
};

const root = path.join(__dirname, '..');
eval(fs.readFileSync(path.join(root, 'world-engine-worldbook.js'), 'utf8'));

const wb = window.WORLD_ENGINE_WORLDBOOK;
assert(wb && typeof wb.activationOf === 'function', 'activationOf should be exported for tests');
assert.strictEqual(wb.triggerEnabled(), true);

{
  const result = wb.activationOf({ constant: true, keys: [] }, '', 'auto');
  assert.strictEqual(result.active, true);
}

{
  const result = wb.activationOf({ constant: true, keys: [] }, '', 'off');
  assert.strictEqual(result.active, false);
}

{
  const result = wb.activationOf({ keys: ['campus'] }, 'modern campus city', 'key');
  assert.strictEqual(result.active, true);
}

{
  const result = wb.activationOf({ keys: ['xianxia'] }, 'modern campus city', 'key');
  assert.strictEqual(result.active, false);
}

{
  const result = wb.activationOf({ keys: ['/campus/i'] }, 'CAMPUS life', 'key');
  assert.strictEqual(result.active, true);
}

{
  const result = wb.activationOf({ keys: ['campus'], secondaryKeys: ['city'], selective: true, selectiveLogic: 0 }, 'campus city', 'key');
  assert.strictEqual(result.active, true);
}

{
  wb.saveSelection(['a', 'b'], { a: 'const', b: 'auto', c: 'off' });
  assert.deepStrictEqual(wb.getSelectedIds(), ['a', 'b']);
  assert.deepStrictEqual(wb.getOverrides(), { a: 'const' });
}

console.log('Worldbook trigger tests: 7 passed');
