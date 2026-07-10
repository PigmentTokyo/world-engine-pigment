/* 引擎段落覆写（世界观预设 engineSegments）回归测试
 * 铁律：预设未覆写时，引擎角色/因果步骤两段必须逐字节等于默认常量（基线契约）。
 * 用法：node tests/engine-segments.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
globalThis.window = {
  WORLD_ENGINE_CORE: {},
  WORLD_ENGINE_API: {}
};

eval.call(globalThis, fs.readFileSync(path.join(root, 'world-engine-evolution.js'), 'utf8'));
const EVO = window.WORLD_ENGINE_EVOLUTION;

assert(typeof EVO.getEngineSegments === 'function', 'getEngineSegments 应导出');
assert(EVO.DEFAULT_SEGS && typeof EVO.DEFAULT_SEGS.engineRole === 'string', 'DEFAULT_SEGS 应导出');
assert.strictEqual(window.WORLD_ENGINE_EVOLUTION_DEFAULT_SEGS, EVO.DEFAULT_SEGS, 'window 暴露应与导出同一对象');

const DEF_ROLE = EVO.DEFAULT_SEGS.engineRole;
const DEF_STEPS = EVO.DEFAULT_SEGS.causalSteps;
assert(DEF_ROLE.includes('世界推演引擎'), '默认引擎角色文本完整性');
assert(DEF_STEPS.startsWith('推演时按以下因果顺序检查：'), '默认因果步骤文本完整性');
assert(/10\. /.test(DEF_STEPS), '默认因果步骤应含 10 步');

// 1) 无预设系统 → 逐字节等于默认
{
  delete window.WORLD_ENGINE_PRESETS;
  const segs = EVO.getEngineSegments();
  assert.strictEqual(segs.engineRole, DEF_ROLE);
  assert.strictEqual(segs.causalSteps, DEF_STEPS);
  assert.strictEqual(segs.engineRoleOverridden, false);
  assert.strictEqual(segs.causalStepsOverridden, false);
}

// 2) 预设存在但无 engineSegments 字段（存量预设） → 默认
{
  window.WORLD_ENGINE_PRESETS = { getActivePreset: () => ({ id: 'old', name: '旧预设' }) };
  const segs = EVO.getEngineSegments();
  assert.strictEqual(segs.engineRole, DEF_ROLE);
  assert.strictEqual(segs.causalSteps, DEF_STEPS);
}

// 3) 字段存在但为空串/纯空白 → 视为未覆写，逐字节默认
{
  window.WORLD_ENGINE_PRESETS = { getActivePreset: () => ({ engineSegments: { engineRole: '', causalSteps: '   \n ' } }) };
  const segs = EVO.getEngineSegments();
  assert.strictEqual(segs.engineRole, DEF_ROLE);
  assert.strictEqual(segs.causalSteps, DEF_STEPS);
  assert.strictEqual(segs.engineRoleOverridden, false);
  assert.strictEqual(segs.causalStepsOverridden, false);
}

// 4) 单段覆写 → 目标段替换（保留原文不 trim），另一段仍默认
{
  const myRole = '你是一个冷酷的末日世界推演引擎。\n倾向让事态恶化。';
  window.WORLD_ENGINE_PRESETS = { getActivePreset: () => ({ engineSegments: { engineRole: myRole, causalSteps: '' } }) };
  const segs = EVO.getEngineSegments();
  assert.strictEqual(segs.engineRole, myRole);
  assert.strictEqual(segs.causalSteps, DEF_STEPS);
  assert.strictEqual(segs.engineRoleOverridden, true);
  assert.strictEqual(segs.causalStepsOverridden, false);
}

// 5) 双段覆写
{
  window.WORLD_ENGINE_PRESETS = { getActivePreset: () => ({ engineSegments: { engineRole: 'R', causalSteps: 'S' } }) };
  const segs = EVO.getEngineSegments();
  assert.strictEqual(segs.engineRole, 'R');
  assert.strictEqual(segs.causalSteps, 'S');
}

// 6) getActivePreset 抛异常 → 安全回退默认
{
  window.WORLD_ENGINE_PRESETS = { getActivePreset: () => { throw new Error('boom'); } };
  const segs = EVO.getEngineSegments();
  assert.strictEqual(segs.engineRole, DEF_ROLE);
  assert.strictEqual(segs.causalSteps, DEF_STEPS);
}

// 7) 源码级契约：prompt 组装走 getEngineSegments，且稳定 ID 协议独立拼接（不在可覆写范围内）
{
  const src = fs.readFileSync(path.join(root, 'world-engine-evolution.js'), 'utf8');
  assert.match(src, /const engineSegs = getEngineSegments\(\);/, 'callEvolutionAPI 应走覆写解析');
  assert.match(src, /segEngineRole \+ '\\n\\n' \+ ENTITY_ID_PROTOCOL \+/, 'ID 协议必须独立拼接在引擎角色之后');
  // 默认文本单一真相源：组装区不得再出现内联的默认段落文本
  const assembleArea = src.slice(src.indexOf('async function callEvolutionAPI'));
  assert.ok(!assembleArea.includes('你是一个世界推演引擎'), '默认引擎角色文本不得在组装区重复内联');
}

console.log('engine segments tests passed');
