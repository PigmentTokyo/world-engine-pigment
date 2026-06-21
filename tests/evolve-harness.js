/* 动态推演闸门 · harness
 * 目标：在 node 里把 evolve() 跑成确定性，逐轮快照 state，作为 evolution 合并/解析改造的回归基准。
 * 手法：① 种子化 Math.random（让骰子可复现）② mock LLM（callApi 返回脚本化 update）
 *      ③ 加载真实 core/presets/rules/evolution（合并逻辑用真的）④ 固定场景脚本跑 N 轮。
 * 用法：
 *   node tests/evolve-harness.js            → 有基线则比对；无则创建
 *   node tests/evolve-harness.js --update   → 强制重写基线
 * 退出码 0=零差异/已创建；1=有差异。
 */
const fs = require('fs');
const path = require('path');

// ---- 1) 种子化随机 ----
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function reseed(seed) { const rng = mulberry32(seed); Math.random = rng; }

// 冻结时间：消除 Date.now() 类非确定性（如 state.lastUpdated.timestamp）
const FIXED_NOW = 1700000000000;
Date.now = () => FIXED_NOW;

// ---- 2) 环境桩 ----
const mem = {};
globalThis.SillyTavern = { getContext: () => ({ chat: [], characters: [], characterId: 0, name1: 'User', name2: 'Char' }) };
globalThis.window = {
  SillyTavern: globalThis.SillyTavern,
  WORLD_ENGINE_STORE: {
    hydrate: async () => {}, keys: () => Object.keys(mem),
    getItem: (k) => (mem[k] !== undefined ? mem[k] : null),
    setItem: (k, v) => { mem[k] = v; }, removeItem: (k) => { delete mem[k]; }
  }
};

const root = path.join(__dirname, '..');
function load(file) { eval.call(globalThis, fs.readFileSync(path.join(root, file), 'utf8')); }
load('world-engine-core.js');
load('world-engine-presets.js');
load('world-engine-rules-loader.js');

const core = globalThis.window.WORLD_ENGINE_CORE;
const P = globalThis.window.WORLD_ENGINE_PRESETS;

// 固定使用古风预设，保证场景稳定
P.setActivePreset('ancient_chinese');

// ---- 3) 把 bookkeeping（依赖存档/指纹/SillyTavern）打成确定性桩，合并函数保持真实 ----
core.hasState = () => true;
core.isNewRound = () => true;
core.restoreCheckpoint = () => null;
core.saveCheckpoint = () => {};
core.saveFingerprint = () => {};
core.getChatFingerprint = () => 'fp';
core.saveStateWithLayer = () => {};
core.saveState = () => {};
core.getUserPersona = () => '';
core.getUserName = () => 'User';

// ---- 4) mock API ----
let _scriptedUpdate = {};
globalThis.window.WORLD_ENGINE_API = {
  callApi: async () => JSON.stringify(_scriptedUpdate),
  parseJSON: (s) => JSON.parse(s),
  getSettings: () => ({})
};
globalThis.window.WORLD_ENGINE_WORLDBOOK = undefined; // evolve 用可选链处理

load('world-engine-evolution.js');
const EVO = globalThis.window.WORLD_ENGINE_EVOLUTION;

// ---- 5) 固定场景：初始 state + 逐轮脚本化 update ----
const state = core.getDefaultState();
state.round = 0;

const ROUNDS = [
  { // 第1轮：各模块新增
    events: [{ name: '血刀门复仇', type: 'conflict', level: 2, stage: '发酵', stageRound: 4, desc: '追兵抵近渡口' },
             { name: '青炉司改良火药', type: 'progress', level: 3, stage: '执行', stageRound: 3, desc: '试小炉' }],
    factions: [{ name: '血刀门', scope: '北境三郡', status: '稳固', relation: '敌对', currentGoal: '夺回码头', core_person: '沈缺', powerPillars: ['武力', '财源'] }],
    winds: [{ topic: '渡口封锁', type: 'report', level: 2, content: '北渡口被封', scope: '北渡口', source: '船夫' }],
    worldTrends: [{ name: '北境军粮短缺', scope: '北境诸郡', status: '持续中', description: '粮道受阻', source: '边境战事' }],
    economy: { climate: '衰退', signals: [{ summary: '粮价上涨', scope: '北境' }] },
    reputation: { authority: '默默无闻', common: '受人尊敬', shadow: '默默无闻', circuit: '默默无闻', lastChange: '救助难民' },
    enemies: [{ name: '血刀门少主', reason: '杀其亲族', type: 'blood', status: '追踪中' }],
    influenceChain: [{ trigger: '渡口封锁风声', impact: '商队改道', fallout: '军需紧张' }],
    blackbox: { secretActions: [{ action: '密室会谈', witnesses: '无' }], secretAssets: [{ name: '密信', exposure: 20, status: '隐藏' }] },
    world_digest: '北境渡口风波起。'
  },
  { // 第2轮：更新已有 + 新增
    events: [{ name: '血刀门复仇', type: 'conflict', level: 2, stage: '逼近', stageRound: 6, desc: '追兵设伏' }],
    factions: [{ name: '青炉司', scope: '西关', status: '鼎盛', relation: '中立', currentGoal: '量产火药', core_person: '司丞', powerPillars: ['技术'] }],
    winds: [{ topic: '渡口封锁', type: 'rumor', level: 3, content: '封锁要持续半月', scope: '北境', source: '脚夫' }],
    economy: { climate: '动荡', signals: [{ summary: '盐价飞涨', scope: '西关' }] },
    reputation: { common: '万众敬仰', lastChange: '平息骚乱' },
    world_digest: '战事吃紧，物价飞腾。'
  },
  { // 第3轮：终局 + 收尾
    events: [{ name: '血刀门复仇', type: 'conflict', level: 2, stage: '已爆发', stageRound: 9, desc: '渡口火并爆发' }],
    enemies: [{ name: '血刀门少主', reason: '杀其亲族', type: 'blood', status: '已终结' }],
    worldTrends: [{ name: '北境军粮短缺', scope: '北境诸郡', status: '已结束', description: '粮道恢复', source: '战事平息' }],
    world_digest: '渡口血案落幕。'
  }
];

async function run() {
  const snapshots = [];
  for (let i = 0; i < ROUNDS.length; i++) {
    reseed(1000 + i);                 // 每轮固定种子
    _scriptedUpdate = ROUNDS[i];
    const okFlag = await EVO.evolve(state, '用户消息' + i, 'AI消息' + i, { mode: 'forward', dialogueText: '对话' + i });
    snapshots.push({ round: i + 1, ok: okFlag, state: JSON.parse(JSON.stringify(state)) });
  }
  return snapshots;
}

run().then((snapshots) => {
  const baselinePath = path.join(__dirname, 'baselines', 'dynamic-evolve-baseline.json');
  const update = process.argv.includes('--update');
  const now = JSON.stringify(snapshots, null, 2);

  if (update || !fs.existsSync(baselinePath)) {
    fs.writeFileSync(baselinePath, now);
    console.log((update ? '已强制重写' : '基线不存在，已创建') + '：' + path.basename(baselinePath) + '（' + snapshots.length + ' 轮快照）');
    process.exit(0);
  }
  const base = fs.readFileSync(baselinePath, 'utf8');
  if (base === now) {
    console.log('✅ 动态闸门零差异（' + snapshots.length + ' 轮 state 演化一致）');
    process.exit(0);
  }
  // 粗定位首个差异轮
  let diffRound = '?';
  try {
    const a = JSON.parse(base), b = snapshots;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) { diffRound = i + 1; break; }
    }
  } catch (e) {}
  console.error('⚠️ 动态闸门发现差异（首个差异轮：第 ' + diffRound + ' 轮）。如确认是预期改动，跑 --update 重置基线。');
  process.exit(1);
}).catch((e) => { console.error('harness 运行出错:', e); process.exit(2); });
