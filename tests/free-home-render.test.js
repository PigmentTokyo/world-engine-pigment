const assert = require('assert');
const fs = require('fs');
const path = require('path');

globalThis.document = { addEventListener: () => {} };

const descriptors = [
  {
    id: 'campusSystems',
    name: '学园沙箱',
    kind: 'custom',
    enabled: true,
    container: 'array',
    field: 'campusSystems',
    fields: {
      name: { label: '地点' },
      tone: { label: '氛围' },
      conflict: { label: '冲突' }
    },
    display: { style: 'cards', titleField: 'name', badgeFields: ['tone'], bodyFields: ['conflict'] }
  },
  {
    id: 'modernDramas',
    name: '都市关系',
    kind: 'custom',
    enabled: true,
    container: 'array',
    field: 'modernDramas',
    fields: {
      name: { label: '人物' },
      pressure: { label: '压力' }
    },
    display: { style: 'cards', titleField: 'name', bodyFields: ['pressure'] }
  }
];

const state = {
  round: 1,
  stability: 100,
  worldDigest: '第二横滨的海风拂过码头，学园的新学期开始了。',
  campusSystems: [
    { name: '海上市学园', tone: '日常喜剧', conflict: '社团竞争' },
    { name: '第二码头', tone: '都市传闻', conflict: '旧案回声' }
  ],
  modernDramas: [{ name: '学生会', pressure: '竞选临近' }],
  events: [],
  factions: [],
  winds: [],
  worldTrends: [],
  regionalIncident: { active: false },
  economy: {},
  reputation: {},
  enemies: [],
  influenceChain: [],
  blackbox: {},
  memories: []
};

globalThis.window = {
  WORLD_ENGINE_CORE: {
    renderUserName: (text) => String(text == null ? '' : text),
    loadState: () => state
  },
  WORLD_ENGINE_EVOLUTION: {},
  WORLD_ENGINE_PRESETS: {
    getActivePreset: () => ({ id: 'free_home_test', mode: 'free', modules: descriptors }),
    uiLabel: (text) => text,
    uiPoem: () => '',
    uiMotto: () => '',
    uiMood: () => '',
    uiSummaryEmpty: () => ''
  },
  WORLD_ENGINE_RULES: {
    getActiveModuleDescriptors: () => descriptors
  }
};

eval(fs.readFileSync(path.join(__dirname, '..', 'world-engine-ui.js'), 'utf8'));

const UI = globalThis.window.WORLD_ENGINE_UI;
assert(UI && UI.__test && typeof UI.__test.renderHomeView === 'function', 'home renderer should be exported for tests');
UI.__test.resetPager();

const html = UI.__test.renderHomeView(state, 0, 'state');
assert(html.includes('学园沙箱'));
assert(html.includes('都市关系'));
assert(html.includes('氛围 · 冲突'));
assert(html.includes('压力'));
assert(html.includes('2'));
assert(html.includes('世界概览'));
assert(html.includes('稳定'));
assert(!html.includes('天下太平'));
assert(!html.includes('天下大势 · 区域事件 · 账本'));
assert(!html.includes('事件链 · 风声 · 影响链'));

console.log('Free home render tests: 1 passed');