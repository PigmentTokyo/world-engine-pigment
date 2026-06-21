const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const mem = {};
let hasSelectionValue = true;
let selectedIdsValue = ['modern::1', 'disabled::3'];

globalThis.window = {
  WORLD_ENGINE_STORE: {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null),
    setItem: (key, value) => { mem[key] = value; },
    removeItem: (key) => { delete mem[key]; },
    keys: () => Object.keys(mem)
  },
  WORLD_ENGINE_CORE: {
    getUserPersona: () => ''
  },
  WORLD_ENGINE_WORLDBOOK: {
    hasSelection: () => hasSelectionValue,
    getSelectedIds: () => selectedIdsValue,
    loadCurrentEntries: async () => [
      { id: 'modern::1', title: '现代都市校园', content: '学生会、社团、考试周与城市生活。', disabled: false },
      { id: 'xianxia::2', title: '古风仙侠', content: '仙人魔妖共存，宗门林立。', disabled: false },
      { id: 'disabled::3', title: '关闭条目', content: '这个关闭条目不应出现。', disabled: true },
      { id: 'modern_ascii::4', title: 'Modern Campus', content: 'student council clubs city daily life', disabled: false },
      { id: 'xianxia_ascii::5', title: 'Xianxia Realm', content: 'immortals and demons coexist in sects', disabled: false }
    ],
    loadCurrentCharacterProfile: () => ''
  }
};

globalThis.window.window = globalThis.window;
globalThis.window.console = console;
globalThis.window.Date = Date;

eval.call(globalThis.window, fs.readFileSync(path.join(root, 'world-engine-presets.js'), 'utf8'));

const P = window.WORLD_ENGINE_PRESETS;
assert(P && typeof P._buildGenerationSource === 'function', 'generation source test hook should exist');

async function main() {
  let source = await P._buildGenerationSource({ includeUserPersona: false });
  assert(source.worldbookText.includes('现代都市校园'));
  assert(source.worldbookText.includes('学生会、社团'));
  assert(!source.worldbookText.includes('古风仙侠'));
  assert(!source.worldbookText.includes('仙人魔妖共存'));
  assert(!source.worldbookText.includes('关闭条目'));

  selectedIdsValue = ['xianxia_ascii::5'];
  source = await P._buildGenerationSource({
    includeUserPersona: false,
    worldbookEntryIds: ['modern_ascii::4']
  });
  assert(source.worldbookText.includes('Modern Campus'));
  assert(source.worldbookText.includes('student council clubs'));
  assert(!source.worldbookText.includes('Xianxia Realm'));
  assert(!source.worldbookText.includes('immortals and demons'));

  hasSelectionValue = false;
  selectedIdsValue = [];
  source = await P._buildGenerationSource({ includeUserPersona: false });
  assert(source.worldbookText.includes('现代都市校园'));
  assert(source.worldbookText.includes('古风仙侠'));
  assert(!source.worldbookText.includes('关闭条目'));

  hasSelectionValue = true;
  selectedIdsValue = [];
  await assert.rejects(
    () => P._buildGenerationSource({ includeUserPersona: false }),
    /No worldbook entries/
  );

  console.log('Generation source selection tests: 4 passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
