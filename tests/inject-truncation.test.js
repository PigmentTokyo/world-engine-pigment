// 注入长度上限：超出时只截世界状态、行为规则整段保留，并把截断信息交给注入自检
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const mem = {};
globalThis.window = {
  WORLD_ENGINE_STORE: {
    getItem: (k) => (mem[k] !== undefined ? mem[k] : null),
    setItem: (k, v) => { mem[k] = v; }
  }
};
for (const f of ['world-engine-presets.js', 'world-engine-rules-loader.js', 'world-engine-api.js', 'world-engine-inject.js']) {
  eval(fs.readFileSync(path.join(root, f), 'utf8'));
}
const P = window.WORLD_ENGINE_PRESETS;
const R = window.WORLD_ENGINE_RULES;
const inj = window.WORLD_ENGINE_INJECT;
const settings = window.WORLD_ENGINE_API.getSettings();
P.setActivePreset('cyberpunk');
const rules = P.applyDisplayTerms(R.getCoreRulesSummary()).replace(/\s+$/, '');
const RULES_TAIL = '正文必须按其当前可用性处理。';
assert(rules.endsWith(RULES_TAIL), '规则末句锚点已变，请同步更新本测试');

function bigState(n) {
  return {
    round: 30,
    worldDigest: '同盟与帝国的对峙仍在持续。',
    events: Array.from({ length: n }, (_, i) => ({ id: 'e' + i, name: '事件' + i, type: 'conflict', level: 4, stage: '发酵', stageRound: 4 })),
    winds: Array.from({ length: n }, (_, i) => ({ type: 'rumor', level: 4, scope: '海尼森', content: '传闻'.repeat(50) + i })),
    factions: [],
    worldTrends: []
  };
}

// 1. 未超限：不截断，结果以标题开头、以完整规则结尾，信息如实
settings.injectMaxChars = 0;
let out = inj.buildContext(bigState(2), []);
let built = inj.getLastBuildInfo();
assert(out.startsWith('【世界状态】'));
assert(out.endsWith(rules));
assert.strictEqual(built.text, out);
assert.strictEqual(built.info.truncated, false);
assert.strictEqual(built.info.injectedLength, out.length);
assert.strictEqual(built.info.fullLength, out.length);

// 2. 超限：总长不超过上限，规则整段保留，世界状态末尾带省略提示，断在整行或分号处
settings.injectMaxChars = 5000;
const full = (() => { settings.injectMaxChars = 0; const s = inj.buildContext(bigState(40), []); settings.injectMaxChars = 5000; return s; })();
assert(full.length > 5000, '测试数据应超出上限');
out = inj.buildContext(bigState(40), []);
built = inj.getLastBuildInfo().info;
assert(out.length <= 5000, '截断后不应超过上限');
assert(out.startsWith('【世界状态】'), '哨兵必须保留在开头');
assert(out.endsWith(rules), '行为规则必须整段保留');
assert(out.includes('[世界状态超出注入上限，以下内容已省略]'));
const statePart = out.slice(0, out.indexOf('[世界状态超出注入上限'));
assert(full.startsWith(statePart.replace(/\n$/, '')), '保留的世界状态应是原文前缀');
assert.strictEqual(built.truncated, true);
assert.strictEqual(built.overLimit, false);
assert.strictEqual(built.fullLength, full.length);
assert.strictEqual(built.injectedLength, out.length);
assert.strictEqual(built.rulesLength, rules.length);
assert(built.keptStateLength < built.stateLength);

// 3. 上限比规则还短：仍保留完整规则与标题，标记 overLimit
settings.injectMaxChars = 1000;
out = inj.buildContext(bigState(40), []);
built = inj.getLastBuildInfo().info;
assert(out.startsWith('【世界状态】'));
assert(out.endsWith(rules), '上限过小时也不得截掉规则');
assert.strictEqual(built.truncated, true);
assert.strictEqual(built.overLimit, true);
assert(out.length > 1000);

// 4. 注入自检与 UI 接线
const inspector = fs.readFileSync(path.join(root, 'world-engine-inject-inspector.js'), 'utf8');
assert(inspector.includes('built.text === String(entry.value)'), '自检只采用与本轮注册内容一致的截断信息');
assert.strictEqual((inspector.match(/truncation: env\.truncation/g) || []).length, 2, '对话补全与文本补全快照都应带截断信息');
const ui = fs.readFileSync(path.join(root, 'world-engine-ui.js'), 'utf8');
assert(ui.includes('we-inject-truncation'), '注入自检卡应显示截断行');
assert(ui.includes('行为规则 '), '截断行应说明规则完整保留');

settings.injectMaxChars = 5000;
console.log('inject-truncation tests: untruncated / state-only cut / over-limit / inspector wiring passed');
