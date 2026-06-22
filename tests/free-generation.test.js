const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const mem = {};
let lastPrompt = '';
let responseMode = 'campus';

globalThis.window = {
  WORLD_ENGINE_STORE: {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null),
    setItem: (key, value) => { mem[key] = value; },
    removeItem: (key) => { delete mem[key]; },
    keys: () => Object.keys(mem)
  },
  WORLD_ENGINE_CORE: {
    getUserPersona: () => '',
    renderUserName: (text) => text
  },
  WORLD_ENGINE_WORLDBOOK: {
    hasSelection: () => true,
    getSelectedIds: () => ['campus::1'],
    loadCurrentEntries: async () => [
      { id: 'campus::1', title: 'Modern Campus', content: 'student council clubs city daily life', disabled: false },
      { id: 'xianxia::2', title: 'Xianxia Realm', content: 'cultivation realms sect trials spirit qi', disabled: false },
      { id: 'wasteland::3', title: 'Wasteland Holdout', content: 'water ration diesel generator raider pressure', disabled: false }
    ],
    loadCurrentCharacterProfile: () => ''
  },
  WORLD_ENGINE_API: {
    callApi: async (prompt) => {
      lastPrompt = prompt;
      if (responseMode === 'empty') return JSON.stringify({ name: 'Broken Free', description: 'bad', modules: [] });
      return JSON.stringify(makeResponse(responseMode));
    }
  }
};

globalThis.window.window = globalThis.window;
globalThis.window.console = console;
globalThis.window.Date = Date;
globalThis.document = { addEventListener: () => {} };

function customModule(id, field, rules, statusValues) {
  return {
    id,
    name: id,
    kind: 'custom',
    enabled: true,
    order: 2,
    container: 'array',
    field,
    itemKey: 'name',
    rules,
    fields: {
      name: { type: 'string', description: 'entry name', example: id + ' item', display: true },
      status: { type: 'enum', enum: statusValues, description: 'current state', example: statusValues[0], display: true }
    },
    display: { style: 'cards', titleField: 'name', badgeFields: ['status'], bodyFields: [], emptyText: 'No entries' },
    mechanics: {}
  };
}

function makeResponse(mode) {
  if (mode === 'xianxia') {
    return {
      name: 'Xianxia Free',
      description: 'Tracks sect cultivation arcs.',
      mode: 'free',
      modules: [customModule('cultivationTracks', 'cultivationTracks', 'Track cultivation breakthroughs, sect trials, and spirit qi changes.', ['mortal', 'adept'])]
    };
  }
  if (mode === 'wasteland') {
    return {
      name: 'Wasteland Free',
      description: 'Tracks survival logistics.',
      mode: 'free',
      modules: [customModule('settlementResources', 'settlementResources', 'Track water, fuel, generator stability, and raider pressure.', ['scarce', 'stable'])]
    };
  }
  return {
    name: 'Campus Free',
    description: 'Tracks modern campus life without fantasy noise.',
    mode: 'free',
    modules: [
      { id: 'events', kind: 'builtin', enabled: true, order: 1 },
      customModule('campusSystems', 'campusSystems', 'Track clubs, student council, and school-life institutions only when plot changes them.', ['stable', 'tense'])
    ],
    ui: { summaryEmpty: 'Campus is quiet.' }
  };
}

eval.call(globalThis.window, fs.readFileSync(path.join(root, 'world-engine-presets.js'), 'utf8'));
eval.call(globalThis.window, fs.readFileSync(path.join(root, 'world-engine-rules-loader.js'), 'utf8'));

const P = window.WORLD_ENGINE_PRESETS;
const R = window.WORLD_ENGINE_RULES;
assert(P && typeof P.generateFromWorldbook === 'function', 'generateFromWorldbook should exist');
assert(P && typeof P._buildFreeGenerationPrompt === 'function', 'free generation prompt hook should exist');
assert(R && typeof R.getActiveModuleDescriptors === 'function', 'rules loader should exist');

async function generateAndAssert(mode, entryId, field, promptNeedle, promptExcluded, options = {}) {
  responseMode = mode;
  const generated = await P.generateFromWorldbook({
    generationMode: 'free',
    includeUserPersona: false,
    includeCharacterDescription: false,
    worldbookEntryIds: [entryId],
    ...options
  });
  assert(lastPrompt.includes('自由模式'));
  assert(lastPrompt.includes('modules[]'));
  assert(lastPrompt.includes(promptNeedle));
  if (promptExcluded) assert(!lastPrompt.includes(promptExcluded));
  if (options.moduleCountMode === 'fixed') assert(lastPrompt.includes('恰好为 ' + options.moduleCount + ' 个'));
  assert.strictEqual(generated.mode, 'free');
  assert(generated.modules.some((module) => module.field === field));

  P.setActivePreset(generated.id);
  const descriptors = R.getActiveModuleDescriptors();
  assert(descriptors.some((descriptor) => descriptor.field === field));
  const rulesText = R.getAllRulesText();
  assert(rulesText.includes(field));
  const schemas = R.getActiveOutputSchemas();
  assert(schemas.some((schema) => schema.field === field));
  return generated;
}

async function main() {
  const campus = await generateAndAssert('campus', 'campus::1', 'campusSystems', 'student council clubs', 'cultivation realms', { moduleCountMode: 'fixed', moduleCount: 2 });
  assert.strictEqual(campus.modules[0].kind, 'builtin');
  assert.strictEqual(campus.modules[0].id, 'events');

  await generateAndAssert('xianxia', 'xianxia::2', 'cultivationTracks', 'cultivation realms', 'water ration');
  await generateAndAssert('wasteland', 'wasteland::3', 'settlementResources', 'water ration', 'student council clubs');

  responseMode = 'campus';
  await assert.rejects(
    () => P.generateFromWorldbook({ generationMode: 'free', includeUserPersona: false, worldbookEntryIds: ['campus::1'], moduleCountMode: 'fixed', moduleCount: 1 }),
    /returned 2 free modules/
  );

  responseMode = 'empty';
  await assert.rejects(
    () => P.generateFromWorldbook({ generationMode: 'free', includeUserPersona: false, worldbookEntryIds: ['campus::1'] }),
    /did not return any free modules/
  );

  console.log('Free generation tests: 39 passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});