const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
globalThis.window = {
  WORLD_ENGINE_CORE: {},
  WORLD_ENGINE_API: {}
};

eval.call(globalThis, fs.readFileSync(path.join(root, 'world-engine-evolution.js'), 'utf8'));

const StageMachine = window.WORLD_ENGINE_EVOLUTION._STAGE_MACHINE;
const config = window.WORLD_ENGINE_EVOLUTION._EVENT_STAGE_MACHINE_CONFIG;
assert(StageMachine && typeof StageMachine.advance === 'function', 'StageMachine.advance should be exported for tests');
assert(config && config.progressMax === 9, 'event stage config should be exported for tests');

{
  const ev = { type: 'unknown' };
  StageMachine.normalize(config, ev);
  assert.strictEqual(ev.type, 'conflict');
  assert.strictEqual(ev.stage, '萌芽');
  assert.strictEqual(ev.stageRound, 1);
}

{
  const ev = { type: 'conflict', stage: '已爆发', stageRound: 9 };
  assert.strictEqual(StageMachine.isTerminal(config, ev), true);
  assert.strictEqual(StageMachine.isAtFinalStage(config, ev, 'conflict'), true);
}

{
  const ev = { type: 'conflict', stage: '萌芽', stageRound: 8 };
  StageMachine.advance(config, ev);
  assert.strictEqual(ev.stage, '发酵');
  assert.strictEqual(ev.stageRound, 1);
}

{
  const ev = { type: 'progress', stage: '关键', stageRound: 8 };
  StageMachine.advance(config, ev);
  assert.strictEqual(ev.stage, '已完成');
  assert.strictEqual(ev.stageRound, 9);
  assert.strictEqual(StageMachine.isTerminal(config, ev), true);
}

{
  const ev = { type: 'conflict', stage: '发酵', stageRound: 11 };
  StageMachine.resolveProgressOverflow(config, ev, { carryOverflow: true });
  assert.strictEqual(ev.stage, '逼近');
  assert.strictEqual(ev.stageRound, 2);
}
{
  const ev = { type: 'conflict', stage: '逼近', stageRound: 9 };
  StageMachine.resolveProgressOverflow(config, ev, { carryOverflow: true });
  assert.strictEqual(ev.stage, '已爆发');
  assert.strictEqual(ev.stageRound, 9);
}

{
  const ev = { type: 'progress', stage: '执行', stageRound: 1 };
  StageMachine.recede(config, ev);
  assert.strictEqual(ev.stageRound, 1);
}

console.log('StageMachine tests: 7 passed');
