/* reroll-round.test.js — 回归：forward / 自动重 roll / redo 三分基底 + 轮次计数
 * 锁定移植上游 v2.3.18 的修复（原 fork 有两处真 bug：无条件 round++、自动重 roll 误从存档点恢复）。
 * 断言：
 *   forward      → round++；saveCheckpoint + saveFingerprint 各 1 次。
 *   自动重 roll   → round 不变；不 restoreCheckpoint（基底=当前 state）；不 saveCheckpoint/Fingerprint。
 *   redo(有 cp)  → 从存档点恢复基底（round=cp.round，state 反映 cp）；不 saveCheckpoint/Fingerprint。
 *   redo(无 cp)  → 返回 false，round 不变，getLastError 含「无存档点」（不退化成伪 forward）。
 *
 * 手法同 evolve-harness：种子化随机 + 冻结时间 + 可控 bookkeeping 桩 + 空 update（隔离出轮次/基底行为）。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// —— 确定性：种子化随机 + 冻结时间 ——
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function reseed(s) { Math.random = mulberry32(s); }
Date.now = () => 1700000000000;

// —— 可控桩状态 + spy 计数 ——
let saveCheckpointCalls = 0, saveFingerprintCalls = 0, restoreCheckpointCalls = 0;
let cpToReturn = null, isNewRoundVal = true;

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
function load(f) { eval.call(globalThis, fs.readFileSync(path.join(root, f), 'utf8')); }
load('world-engine-core.js');
load('world-engine-presets.js');
load('world-engine-rules-loader.js');

const core = globalThis.window.WORLD_ENGINE_CORE;
const P = globalThis.window.WORLD_ENGINE_PRESETS;
P.setActivePreset('ancient_chinese');

// bookkeeping 打成可控桩（合并逻辑保持真实）
core.hasState = () => true;
core.isNewRound = () => isNewRoundVal;
core.restoreCheckpoint = () => { restoreCheckpointCalls++; return cpToReturn; };
core.saveCheckpoint = () => { saveCheckpointCalls++; };
core.saveFingerprint = () => { saveFingerprintCalls++; };
core.getChatFingerprint = () => 'fp';
core.saveStateWithLayer = () => {};
core.saveState = () => {};
core.getUserPersona = () => '';
core.getUserName = () => 'User';

globalThis.window.WORLD_ENGINE_API = {
  callApi: async () => JSON.stringify({ winds: [] }), // 最小合法 update：过校验但全部合并 no-op，且不含 world_digest（不覆盖 worldDigest 基底标记）
  parseJSON: (s) => JSON.parse(s),
  getSettings: () => ({})
};
globalThis.window.WORLD_ENGINE_WORLDBOOK = undefined; // evolve 内以可选链处理

load('world-engine-evolution.js');
const EVO = globalThis.window.WORLD_ENGINE_EVOLUTION;

function freshState(round, digest) {
  const s = core.getDefaultState();
  s.round = round;
  s.worldDigest = digest;
  return s;
}
function resetSpies() { saveCheckpointCalls = 0; saveFingerprintCalls = 0; restoreCheckpointCalls = 0; }
function cp(round) {
  return { round: round, worldDigest: 'CP', memories: [], events: [], factions: [], worldTrends: [], winds: [], enemies: [], influenceChain: [] };
}

async function main() {
  // — S1 forward：round++，存档点前移 + 刷新指纹 —
  {
    reseed(1); resetSpies(); cpToReturn = null; isNewRoundVal = true;
    const s = freshState(5, 'CUR');
    const ok = await EVO.evolve(s, 'u', 'a', { mode: 'forward', dialogueText: '' });
    assert.strictEqual(ok, true, 'S1 forward 应成功');
    assert.strictEqual(s.round, 6, 'S1 forward round 应 5→6');
    assert.strictEqual(saveCheckpointCalls, 1, 'S1 forward 应 saveCheckpoint 1 次');
    assert.strictEqual(saveFingerprintCalls, 1, 'S1 forward 应 saveFingerprint 1 次');
  }

  // — S2 自动重 roll（mode 未传 + isNewRound=false）：round 不变，不 restore、不存档点/指纹 —
  {
    reseed(2); resetSpies(); cpToReturn = cp(99); isNewRoundVal = false; // 即便有 cp 也不该被用作基底
    const s = freshState(6, 'CUR');
    const ok = await EVO.evolve(s, 'u', 'a', { dialogueText: '' });
    assert.strictEqual(ok, true, 'S2 自动重 roll 应成功');
    assert.strictEqual(s.round, 6, 'S2 自动重 roll round 应保持 6（不 ++、不回退到 cp.round=99）');
    assert.strictEqual(s.worldDigest, 'CUR', 'S2 基底应为当前 state（worldDigest 仍 CUR，未被 cp 覆盖）');
    assert.strictEqual(restoreCheckpointCalls, 0, 'S2 自动重 roll 不应 restoreCheckpoint');
    assert.strictEqual(saveCheckpointCalls, 0, 'S2 自动重 roll 不应 saveCheckpoint');
    assert.strictEqual(saveFingerprintCalls, 0, 'S2 自动重 roll 不应 saveFingerprint');
  }

  // — S3 redo（有 cp）：从存档点恢复基底，轮次=cp.round，不存档点/指纹 —
  {
    reseed(3); resetSpies(); cpToReturn = cp(3); isNewRoundVal = false;
    const s = freshState(6, 'CUR');
    const ok = await EVO.evolve(s, 'u', 'a', { mode: 'redo', dialogueText: '' });
    assert.strictEqual(ok, true, 'S3 redo(有cp) 应成功');
    assert.strictEqual(s.round, 3, 'S3 redo round 应=cp.round(3)，不 ++');
    assert.strictEqual(s.worldDigest, 'CP', 'S3 redo 基底应从 cp 恢复（worldDigest=CP）');
    assert.strictEqual(saveCheckpointCalls, 0, 'S3 redo 不应 saveCheckpoint');
    assert.strictEqual(saveFingerprintCalls, 0, 'S3 redo 不应 saveFingerprint');
    assert(restoreCheckpointCalls >= 1, 'S3 redo 应 restoreCheckpoint');
  }

  // — S4 redo（无 cp）：守卫拒绝，返回 false，round 不变，报「无存档点」 —
  {
    reseed(4); resetSpies(); cpToReturn = null; isNewRoundVal = false;
    const s = freshState(6, 'CUR');
    const ok = await EVO.evolve(s, 'u', 'a', { mode: 'redo', dialogueText: '' });
    assert.strictEqual(ok, false, 'S4 redo(无cp) 应返回 false（不退化成伪 forward）');
    assert.strictEqual(s.round, 6, 'S4 redo(无cp) round 应保持 6');
    assert.strictEqual(saveCheckpointCalls, 0, 'S4 redo(无cp) 不应 saveCheckpoint');
    assert(/无存档点/.test(EVO.getLastError() || ''), 'S4 redo(无cp) getLastError 应含「无存档点」');
  }

  console.log('reroll-round tests: 4 场景 / 15 断言 passed');
}

main().catch((e) => { console.error('✗ reroll-round 测试失败:', e && e.stack ? e.stack : e); process.exit(1); });
