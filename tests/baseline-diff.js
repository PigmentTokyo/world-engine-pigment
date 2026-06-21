/* 回归闸门：在 node 里复现 classic 确定性输出，与已捕获基线逐字比对。
 * 用法：node tests/baseline-diff.js [基线json路径]
 * 默认基线：tests/baselines/classic-baseline-pre-refactor.json
 * 退出码 0=零差异；1=有差异/出错。 */
const fs = require('fs');
const path = require('path');

// ---- 环境桩：内存版 WORLD_ENGINE_STORE，满足 presets.js 的存取 ----
const mem = {};
globalThis.window = {
  WORLD_ENGINE_STORE: {
    getItem: (k) => (mem[k] !== undefined ? mem[k] : null),
    setItem: (k, v) => { mem[k] = v; }
  }
};

const root = path.join(__dirname, '..');
eval(fs.readFileSync(path.join(root, 'world-engine-presets.js'), 'utf8'));      // → window.WORLD_ENGINE_PRESETS
eval(fs.readFileSync(path.join(root, 'world-engine-rules-loader.js'), 'utf8')); // → window.WORLD_ENGINE_RULES
const P = globalThis.window.WORLD_ENGINE_PRESETS;
const R = globalThis.window.WORLD_ENGINE_RULES;

const safe = (fn) => { try { return fn(); } catch (e) { return { __error: String(e && e.message || e) }; } };
function snapshot() {
  return {
    activePresetId: safe(() => P.getActivePresetId()),
    ruleText:       safe(() => R.getAllRulesText()),
    coreSummary:    safe(() => R.getCoreRulesSummary()),
    outputInstr:    safe(() => R.buildOutputInstructionsText()),
    outputExample:  safe(() => R.buildOutputExampleJSON()),
    moduleList:     safe(() => R.getModuleList()),
    activeSchemas:  safe(() => R.getActiveOutputSchemas()),
    disabledFields: safe(() => R.getDisabledOutputFields()),
    allowedFields:  safe(() => R.getAllowedOutputFields())
  };
}

const baselinePath = process.argv[2] || path.join(__dirname, 'baselines', 'classic-baseline-pre-refactor.json');
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

// 只比对 classic 相关确定性字段（红线字段）
const RED_FIELDS = ['ruleText', 'coreSummary', 'outputInstr', 'outputExample', 'moduleList', 'activeSchemas', 'disabledFields', 'allowedFields'];

let diffs = [];
const ids = Object.keys(baseline.perPreset || {});
for (const id of ids) {
  const ok = P.setActivePreset(id);
  if (!ok) { diffs.push({ preset: id, field: '(setActivePreset 失败)' }); continue; }
  const now = snapshot();
  const base = (baseline.perPreset[id] || {}).snapshot || {};
  for (const f of RED_FIELDS) {
    if (JSON.stringify(now[f]) !== JSON.stringify(base[f])) {
      diffs.push({ preset: id, field: f });
    }
  }
}

console.log('对照基线: ' + path.basename(baselinePath) + '  | 预设数: ' + ids.length);
if (!diffs.length) {
  console.log('✅ 零差异 — classic 红线守住');
  process.exit(0);
} else {
  console.error('⚠️ 发现差异:');
  for (const d of diffs) console.error('  - [' + d.preset + '] ' + d.field);
  process.exit(1);
}
