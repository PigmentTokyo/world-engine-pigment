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
    getContext: () => ({ chatId: 'regex-chat', chatMetadata: {}, saveMetadataDebounced: () => {} })
  }
};
globalThis.SillyTavern = globalThis.window.SillyTavern;

const root = path.join(__dirname, '..');
eval(fs.readFileSync(path.join(root, 'world-engine-store.js'), 'utf8'));
eval(fs.readFileSync(path.join(root, 'world-engine-core.js'), 'utf8'));

const core = window.WORLD_ENGINE_CORE;
assert(core && typeof core.validateFilterRegex === 'function', 'validateFilterRegex should be exported');

{
  const result = core.validateFilterRegex('/<think>[\\s\\S]*?<\\/think>/\nfoo(');
  assert.strictEqual(result.ok, 1);
  assert.strictEqual(result.bad.length, 1);
  assert.strictEqual(result.entries[0].flags, 'g');
  assert.strictEqual(result.bad[0].line, 2);
}

{
  const result = core.validateFilterRegex('/foo/i\nbar');
  assert.strictEqual(result.ok, 2);
  assert(result.entries.some(entry => entry.pattern === 'foo' && entry.flags.includes('i') && entry.flags.includes('g')));
  assert(result.entries.some(entry => entry.pattern === 'bar' && entry.flags === 'g'));
}

{
  const text = 'before <think>hidden</think> middle foo foo after';
  const output = core.filterDialogue(text, {
    evolveFilterRegex: '/<think>[\\s\\S]*?<\\/think>/\nfoo'
  });
  assert.strictEqual(output, 'before  middle   after');
}

{
  const errors = [];
  const text = 'keep me';
  const output = core.filterDialogue(text, { evolveFilterRegex: 'bad(' }, (line, raw, reason) => errors.push({ line, raw, reason }));
  assert.strictEqual(output, text);
  assert.strictEqual(errors.length, 1);
  assert.strictEqual(errors[0].line, 1);
}

console.log('Regex filter tests: 4 passed');
