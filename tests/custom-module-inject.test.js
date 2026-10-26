// 自定义模块状态进正文注入：混合预设的自定义模块会出现在【世界状态】里，classic 预设不受影响
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const mem = {};
globalThis.window = {
  WORLD_ENGINE_STORE: {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; },
    keys: () => Object.keys(mem)
  }
};
globalThis.window.window = globalThis.window;
globalThis.document = { addEventListener: () => {} };
for (const f of ['world-engine-presets.js', 'world-engine-rules-loader.js', 'world-engine-api.js', 'world-engine-inject.js']) {
  eval.call(globalThis.window, fs.readFileSync(path.join(root, f), 'utf8'));
}
const P = window.WORLD_ENGINE_PRESETS;
const inj = window.WORLD_ENGINE_INJECT;
const settings = window.WORLD_ENGINE_API.getSettings();

const baseState = {
  round: 3, worldDigest: '两国同时陷入内战。',
  events: [], factions: [], winds: [], worldTrends: [],
  fleets: [
    { name: '杨舰队', side: '同盟', commander: '杨威利', strength: '约两万艘', location: '伊谢尔伦要塞', status: '出击准备', mission: '平定边境四星', _internal: 'x' },
    { name: '第十一舰队', side: '同盟（政变派）', commander: '鲁格朗休', location: '海尼森近郊', status: '待命' }
  ],
  frontline: { focus: '香普尔', note: '' }
};

// 1. classic：没有自定义模块，注入里不出现自定义字段
P.setActivePreset('cyberpunk');
settings.injectMaxChars = 0;
const classicOut = inj.buildContext(baseState, []);
assert(!classicOut.includes('杨舰队'), 'classic 预设不应注入自定义模块状态');
assert(!classicOut.includes('舰队与要塞态势'));

// 2. 混合预设：自定义模块按 display 配置写进世界状态，位于行为规则之前
const mixed = P.normalizePreset({
  id: 'logh_test', name: '银英测试', mode: 'free',
  modules: [
    { id: 'events', kind: 'builtin', order: 1 },
    { id: 'factions', kind: 'builtin', order: 2 },
    {
      id: 'fleets', name: '模块十三：舰队与要塞态势', kind: 'custom', order: 13, container: 'array', field: 'fleets', itemKey: 'name',
      rules: '<fleets>追踪主要舰队。</fleets>',
      fields: {
        name: { type: 'string', label: '部队' },
        side: { type: 'string', label: '所属' },
        commander: { type: 'string', label: '司令' },
        strength: { type: 'string', label: '兵力' },
        location: { type: 'string', label: '位置' },
        status: { type: 'string', label: '状态' },
        mission: { type: 'string', label: '任务' }
      },
      display: { style: 'cards', titleField: 'name', badgeFields: ['side'], bodyFields: ['commander', 'strength', 'location', 'status', 'mission'] }
    },
    {
      id: 'frontline', name: '前线焦点', kind: 'custom', order: 14, container: 'object', field: 'frontline',
      rules: '<frontline>当前前线。</frontline>',
      fields: { focus: { type: 'string', label: '焦点' }, note: { type: 'string', label: '备注' } }
    }
  ]
});
P.saveCustomPreset(mixed);
assert(P.setActivePreset('logh_test'), '应能切到混合预设');
const out = inj.buildContext(baseState, []);
assert(out.startsWith('【世界状态】'));
assert(out.includes('舰队与要塞态势：\n- 杨舰队（同盟）；司令：杨威利；兵力：约两万艘；位置：伊谢尔伦要塞；状态：出击准备；任务：平定边境四星'), '数组模块应按 display 字段排成一行一条');
assert(out.includes('- 第十一舰队（同盟（政变派））；司令：鲁格朗休；位置：海尼森近郊；状态：待命'), '空字段应省略');
assert(!out.includes('_internal') && !out.includes('：x'), '下划线开头的内部字段不注入');
assert(out.includes('前线焦点：焦点：香普尔'), '对象模块应写成键值');
assert(!out.includes('模块十三'), '模块名前缀应去掉');
const rules = P.applyDisplayTerms(window.WORLD_ENGINE_RULES.getCoreRulesSummary()).replace(/\s+$/, '');
assert(out.indexOf('舰队与要塞态势') < out.indexOf(rules.slice(0, 20)), '自定义模块应在行为规则之前');

// 3. 空数组写「无」
const emptyOut = inj.buildContext({ ...baseState, fleets: [] }, []);
assert(emptyOut.includes('舰队与要塞态势：无'));

// 4. 超限：自定义模块属于世界状态，随之被截；行为规则完整保留
settings.injectMaxChars = rules.length + 200;
const cut = inj.buildContext({ ...baseState, worldDigest: '长'.repeat(500) }, []);
assert(cut.endsWith(rules), '超限时行为规则仍须完整');
assert(!cut.includes('杨舰队'), '超限时自定义模块应随世界状态一起被截');
assert(inj.getLastBuildInfo().info.truncated === true);

settings.injectMaxChars = 5000;
console.log('custom-module-inject tests: classic untouched / array & object render / empty / truncation passed');
