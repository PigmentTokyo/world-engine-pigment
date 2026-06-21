const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const mem = {};

globalThis.window = {
  WORLD_ENGINE_STORE: {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null),
    setItem: (key, value) => { mem[key] = value; },
    removeItem: (key) => { delete mem[key]; },
    keys: () => Object.keys(mem)
  }
};
globalThis.window.window = globalThis.window;
globalThis.window.console = console;
globalThis.window.Date = Date;

eval.call(globalThis.window, fs.readFileSync(path.join(root, 'world-engine-presets.js'), 'utf8'));

const P = window.WORLD_ENGINE_PRESETS;
const VerdictEngine = P._VERDICT_ENGINE;
const configs = P._VERDICT_CONFIGS;
assert(VerdictEngine && typeof VerdictEngine.normalizeSingleAxis === 'function', 'VerdictEngine should be exported for tests');
assert(configs && configs.reputation && configs.factionStatus, 'Verdict configs should be exported for tests');

{
  const result = VerdictEngine.normalizeSingleAxis(
    configs.factionStatus,
    { '鼎盛': '强盛判词', '繁华': '别名判词' },
    { '鼎盛': 'fallback strong', '稳固': 'fallback stable' },
    { '稳固': '繁华' }
  );
  assert.strictEqual(result['鼎盛'], '强盛判词');
  assert.strictEqual(result['稳固'], '别名判词');
  assert.strictEqual(result['瓦解'], '');
  assert.deepStrictEqual(Object.keys(result), P.getInternalSchema().factionStatuses);
}

{
  const result = VerdictEngine.normalizeAxes(
    configs.reputation,
    { authority: { 'High': '权力顶点' } },
    { common: { '默默无闻': '百姓不知' } },
    { '万众敬仰': 'High' }
  );
  assert.strictEqual(result.authority['万众敬仰'], '权力顶点');
  assert.strictEqual(result.common['默默无闻'], '百姓不知');
  assert.strictEqual(result.shadow['默默无闻'], '');
  assert.deepStrictEqual(Object.keys(result).sort(), ['authority', 'circuit', 'common', 'shadow'].sort());
}

{
  const preset = P.normalizePreset({
    id: 'verdict_test',
    name: '裁决测试',
    termMap: { '繁荣': 'Prosperous', '万众敬仰': 'Legendary' },
    reputation: {
      verdicts: {
        authority: { Legendary: '制度内传奇人物' }
      }
    },
    economy: {
      climateVerdicts: { Prosperous: '市场全面向好' }
    },
    factions: {
      statusVerdicts: { '鼎盛': '组织处于巅峰' },
      relationVerdicts: { '世仇': '不可调和' }
    }
  });
  assert.strictEqual(preset.reputation.verdicts.authority['万众敬仰'], '制度内传奇人物');
  assert.strictEqual(preset.economy.climateVerdicts['繁荣'], '市场全面向好');
  assert.strictEqual(preset.factions.statusVerdicts['鼎盛'], '组织处于巅峰');
  assert.strictEqual(preset.factions.relationVerdicts['世仇'], '不可调和');
  assert.deepStrictEqual(preset.reputation.levels, P.getInternalSchema().reputationLevels);
  assert.deepStrictEqual(preset.factions.statuses, P.getInternalSchema().factionStatuses);
  assert.deepStrictEqual(preset.factions.relations, P.getInternalSchema().factionRelations);
  assert.deepStrictEqual(preset.economy.climates, P.getInternalSchema().economyClimates);
}

{
  const text = VerdictEngine.getText(configs.economyClimate, { '繁荣': '好' }, 'climate', '繁荣', 'fallback');
  const unknown = VerdictEngine.getText(configs.economyClimate, { '繁荣': '好' }, 'climate', '未知', 'fallback');
  assert.strictEqual(text, '好');
  assert.strictEqual(unknown, 'fallback');
}

console.log('VerdictEngine tests: 4 passed');
