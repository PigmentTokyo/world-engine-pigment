const assert = require('assert');
const fs = require('fs');
const path = require('path');

const mem = { a: '1', b: '2' };
globalThis.window = {
  WORLD_ENGINE_VERSION: 'test-version',
  SillyTavern: {
    getContext: () => ({
      chatId: 'diag-chat',
      chat: [{ is_user: true }, { is_user: false }],
      name1: 'User',
      name2: 'AI',
      chatMetadata: {},
      saveMetadataDebounced: () => {}
    })
  },
  WORLD_ENGINE_API: {
    getSettings: () => ({ apiKey: 'secret-key', apiUrl: 'https://example.invalid', worldbookTrigger: true, evolveFilterRegex: 'foo' })
  },
  WORLD_ENGINE_PRESETS: {
    getActivePreset: () => ({ id: 'preset1', name: 'Preset', mode: 'free', builtin: false, disabledModules: ['old'], modules: [{ id: 'm1' }, { id: 'm2' }] })
  },
  WORLD_ENGINE_RULES: {
    getRuleCount: () => 3,
    getActiveModuleDescriptors: () => [{ id: 'm1', field: 'items', kind: 'custom', container: 'array', enabled: true }],
    getActiveModuleDescriptorWarnings: () => ['warning']
  },
  WORLD_ENGINE_CORE: {
    loadState: () => ({ round: 2, chatLayer: 4, worldDigest: 'digest', events: [{}], factions: [], winds: [], worldTrends: [], memories: [], enemies: [], influenceChain: [], economy: { signals: [{}] }, blackbox: { secretActions: [], secretAssets: [] }, regionalIncident: { active: true } }),
    restoreCheckpoint: () => ({ round: 1, chatLayer: 2, time: 't' }),
    hasState: () => true,
    loadFingerprint: () => 'fp',
    getChatLayer: () => 4,
    isNewRound: () => false,
    getLastStoryDay: () => 1,
    getAnchorLayer: () => 0,
    validateFilterRegex: (raw) => ({ ok: raw ? 1 : 0, bad: [], entries: raw ? [{ line: 1, flags: 'g' }] : [] })
  },
  WORLD_ENGINE_EVOLUTION: {
    isRunning: () => false,
    getLastError: () => '',
    getLastDebug: () => ({ prompt: 'prompt text', rawResult: '{"ok":true}', segments: [{ key: 'a' }] })
  },
  WORLD_ENGINE_WORLDBOOK: {
    getSelectedIds: () => ['wb1'],
    getOverrides: () => ({ wb1: 'key' }),
    hasSelection: () => true,
    triggerEnabled: () => true
  },
  WORLD_ENGINE_STORE: {
    keys: () => Object.keys(mem)
  }
};
globalThis.navigator = { userAgent: 'node-test' };

const root = path.join(__dirname, '..');
eval(fs.readFileSync(path.join(root, 'world-engine-diag.js'), 'utf8'));

const diag = window.WORLD_ENGINE_DIAG.collect();
assert.strictEqual(diag.meta.extVersion, 'test-version');
assert.strictEqual(diag.env.chat.total, 2);
assert.strictEqual(diag.settings.apiKey, '*** set (len=10)');
assert.strictEqual(diag.settings.apiUrl, '(set)');
assert.strictEqual(diag.activePreset.moduleCount, 2);
assert.strictEqual(diag.rules.activeModules[0].id, 'm1');
assert.strictEqual(diag.worldState.counts.events, 1);
assert.strictEqual(diag.worldState.regionalIncidentActive, true);
assert.strictEqual(diag.evolution.promptSegmentCount, 1);
assert.strictEqual(diag.worldbook.selectedCount, 1);
assert.strictEqual(diag.filterRegex.validCount, 1);
assert.strictEqual(diag.store.count, 2);

console.log('Diagnostic package tests: 1 passed');
