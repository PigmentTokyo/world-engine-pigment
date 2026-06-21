/* UI 渲染快照闸门 · harness
 * 目标：给每个内置 render<Module> 喂固定数据，抓 HTML 字符串快照，作为「ui 渲染按描述符分发」改造的回归基准。
 * 手法：加载真实 core/presets/rules/ui（经 __test 钩子暴露渲染函数），固定数据集 + 固定调用顺序（pager 计数器每轮重置）。
 * 用法：node tests/ui-render-harness.js [--update]
 * 退出码 0=零差异/已创建；1=有差异。
 */
const fs = require('fs');
const path = require('path');

// ---- 环境桩 ----
globalThis.SillyTavern = { getContext: () => ({ chat: [], characters: [], characterId: 0, name1: 'User', name2: 'Char' }) };
globalThis.document = {
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {}, remove() {}, setAttribute() {} }),
  body: { appendChild() {} }, addEventListener() {}
};
const mem = {};
globalThis.window = {
  SillyTavern: globalThis.SillyTavern,
  WORLD_ENGINE_STORE: { hydrate: async () => {}, keys: () => Object.keys(mem), getItem: (k) => (mem[k] ?? null), setItem: (k, v) => { mem[k] = v; }, removeItem: (k) => { delete mem[k]; } },
  WORLD_ENGINE_API: { getSettings: () => ({}), callApi: async () => '', parseJSON: (s) => JSON.parse(s) },
  WORLD_ENGINE_EVOLUTION: { evolve: async () => true, isRunning: () => false, getLastError: () => '' },
  WORLD_ENGINE_PRESET_UI: undefined
};

const root = path.join(__dirname, '..');
const loadInto = (file) => eval.call(globalThis, fs.readFileSync(path.join(root, file), 'utf8'));
loadInto('world-engine-core.js');
loadInto('world-engine-presets.js');
loadInto('world-engine-rules-loader.js');

const core = globalThis.window.WORLD_ENGINE_CORE;
const P = globalThis.window.WORLD_ENGINE_PRESETS;
P.setActivePreset('ancient_chinese');

// 渲染路径用到的 core.* 打成确定性桩
core.renderUserName = (t) => (t == null ? '' : String(t));
core.getUserName = () => 'User';
core.loadState = () => fixtureState();

loadInto('world-engine-ui.js');
const UI = globalThis.window.WORLD_ENGINE_UI;
const T = UI.__test;

// 一致性锁：BUILTIN_RENDER 键 == 10 个输出模块描述符 id
(function () {
  const R = globalThis.window.WORLD_ENGINE_RULES;
  const outputIds = R.getModuleDescriptors().filter(d => d.container !== 'none').map(d => d.id).sort();
  const renderIds = T.renderIds().slice().sort();
  if (JSON.stringify(outputIds) !== JSON.stringify(renderIds)) {
    console.error('✗ BUILTIN_RENDER 与输出模块描述符不一致');
    console.error('  描述符:', outputIds.join(','), '\n  RENDER :', renderIds.join(','));
    process.exit(3);
  }
  console.log('✓ BUILTIN_RENDER 分发表与描述符一致（' + renderIds.length + ' 个输出模块）');
})();

// ---- 固定数据集 ----
function fixtureState() {
  return {
    round: 5,
    worldDigest: '北境渡口风波起，物价腾贵。',
    stability: 60,
    events: [
      { name: '血刀门复仇', type: 'conflict', level: 2, stage: '逼近', stageRound: 6, desc: '追兵设伏渡口' },
      { name: '青炉司改良火药', type: 'progress', level: 3, stage: '执行', stageRound: 4, desc: '试小炉' }
    ],
    factions: [{ name: '血刀门', scope: '北境三郡', status: '稳固', relation: '敌对', currentGoal: '夺回码头', core_person: '沈缺', powerPillars: ['武力', '财源'] }],
    winds: [{ topic: '渡口封锁', type: 'rumor', level: 3, content: '封锁要持续半月', scope: '北境', source: '脚夫' }],
    worldTrends: [{ name: '北境军粮短缺', scope: '北境诸郡', status: '持续中', description: '粮道受阻', source: '边境战事' }],
    economy: { climate: '动荡', signals: [{ summary: '盐价飞涨', scope: '西关' }] },
    reputation: { authority: '默默无闻', common: '受人尊敬', shadow: '默默无闻', circuit: '默默无闻', lastChange: '平息骚乱' },
    enemies: [{ name: '血刀门少主', reason: '杀其亲族', type: 'blood', status: '追踪中' }],
    influenceChain: [{ trigger: '渡口封锁风声', impact: '商队改道', fallout: '军需紧张' }],
    regionalIncident: { active: true, title: '北渡口大火', type: 'fire', scope: '北渡口', impact: '货运停摆' },
    blackbox: { secretActions: [{ action: '密室会谈', witnesses: '无' }], secretAssets: [{ name: '密信', exposure: 20, status: '隐藏' }] }
  };
}

const safe = (fn) => { try { return fn(); } catch (e) { return '__ERROR__: ' + (e && e.message || e); } };

function snapshot() {
  const s = fixtureState();
  const scope = 'home';
  T.resetPager();
  const snap = {};
  snap.worldCore        = safe(() => T.renderWorldCore(s));
  snap.events           = safe(() => T.renderEventList(s.events, scope));
  snap.factions         = safe(() => T.renderFactionList(s.factions, scope));
  snap.worldTrends      = safe(() => T.renderWorldTrends(s.worldTrends, scope));
  snap.winds            = safe(() => T.renderWindList(s.winds, scope));
  snap.reputation       = safe(() => T.renderReputation(s.reputation, scope));
  snap.economy          = safe(() => T.renderEconomy(s.economy, scope));
  snap.enemies          = safe(() => T.renderEnemies(s.enemies, scope));
  snap.influence        = safe(() => T.renderInfluenceChain(s.influenceChain, scope));
  snap.regional         = safe(() => T.renderRegionalIncident(s.regionalIncident, scope));
  snap.blackbox         = safe(() => T.renderBlackbox(s.blackbox, scope));
  // 端到端（覆盖分发顺序）
  T.resetPager();
  snap.homeExpanded     = safe(() => T.renderHomeViewExpanded(s, 'current', scope));
  T.resetPager(); snap.subSituation = safe(() => T.renderSubView('situation', s, 'current', scope));
  T.resetPager(); snap.subEvents    = safe(() => T.renderSubView('events', s, 'current', scope));
  T.resetPager(); snap.subRelations = safe(() => T.renderSubView('relations', s, 'current', scope));
  T.resetPager(); snap.subResources = safe(() => T.renderSubView('resources', s, 'current', scope));
  T.resetPager(); snap.checkpoint   = safe(() => T.renderCheckpointSections(s, 0));
  return snap;
}

const snap = snapshot();
const errs = Object.entries(snap).filter(([k, v]) => typeof v === 'string' && v.startsWith('__ERROR__'));
if (errs.length) { console.error('渲染出错：', errs.map(e => e[0] + ' → ' + e[1]).join(' | ')); process.exit(2); }

const baselinePath = path.join(__dirname, 'baselines', 'ui-render-baseline.json');
const now = JSON.stringify(snap, null, 2);
if (process.argv.includes('--update') || !fs.existsSync(baselinePath)) {
  fs.writeFileSync(baselinePath, now);
  console.log((fs.existsSync(baselinePath) && !process.argv.includes('--update') ? '基线不存在，已创建' : '已写入基线') + '（' + Object.keys(snap).length + ' 个快照）');
  process.exit(0);
}
const base = fs.readFileSync(baselinePath, 'utf8');
if (base === now) { console.log('✅ UI 渲染闸门零差异（' + Object.keys(snap).length + ' 个快照一致）'); process.exit(0); }
const baseObj = JSON.parse(base);
const diffKeys = Object.keys(snap).filter(k => JSON.stringify(snap[k]) !== JSON.stringify(baseObj[k]));
console.error('⚠️ UI 渲染差异：' + diffKeys.join(', ') + '（如属预期，--update 重置）');
process.exit(1);
