const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
globalThis.window = {
  WORLD_ENGINE_CORE: {},
  WORLD_ENGINE_API: {}
};

eval.call(globalThis, fs.readFileSync(path.join(root, 'world-engine-evolution.js'), 'utf8'));

const DiceEngine = window.WORLD_ENGINE_EVOLUTION._DICE_ENGINE;
assert(DiceEngine && typeof DiceEngine.rollTrigger === 'function', 'DiceEngine.rollTrigger should be exported for tests');

const config = {
  chance: 0.5,
  durationRounds: 5,
  cooldownRounds: 3,
  typeWeights: [
    { type: 'a', label: 'Type A', weight: 1 },
    { type: 'b', label: 'Type B', weight: 3 }
  ]
};

function seq(values) {
  let i = 0;
  let calls = 0;
  const randomFn = () => {
    calls++;
    return values[i++];
  };
  randomFn.calls = () => calls;
  return randomFn;
}

{
  const randomFn = seq([0.75]);
  const roll = DiceEngine.rollTrigger(config, { active: false, cooldown: 0 }, randomFn);
  assert.strictEqual(roll.kind, 'miss');
  assert.strictEqual(roll.triggered, false);
  assert.strictEqual(roll.dice, 0.75);
  assert.deepStrictEqual(roll.patch, { active: false, title: '', type: '', scope: '', impact: '' });
  assert.strictEqual(randomFn.calls(), 1);
}

{
  const randomFn = seq([0.25, 0.9]);
  const roll = DiceEngine.rollTrigger(config, { active: false, cooldown: 0 }, randomFn);
  assert.strictEqual(roll.kind, 'hit');
  assert.strictEqual(roll.triggered, true);
  assert.strictEqual(roll.incidentType, 'b');
  assert.strictEqual(roll.incidentLabel, 'Type B');
  assert.strictEqual(roll.patch.duration, 5);
  assert.strictEqual(roll.patch.cooldown, 0);
  assert.strictEqual(randomFn.calls(), 2);
}

{
  const randomFn = seq([]);
  const roll = DiceEngine.rollTrigger(config, { active: false, cooldown: 2 }, randomFn);
  assert.strictEqual(roll.kind, 'cooldown');
  assert.deepStrictEqual(roll.patch, { cooldown: 1 });
  assert.strictEqual(randomFn.calls(), 0);
}

{
  const randomFn = seq([]);
  const roll = DiceEngine.rollTrigger(config, { active: true, duration: 3 }, randomFn);
  assert.strictEqual(roll.kind, 'ongoing');
  assert.strictEqual(roll.triggered, true);
  assert.deepStrictEqual(roll.patch, { duration: 2 });
  assert.strictEqual(randomFn.calls(), 0);
}

{
  const randomFn = seq([]);
  const roll = DiceEngine.rollTrigger(config, { active: true, title: 'Old Incident', duration: 1 }, randomFn);
  assert.strictEqual(roll.kind, 'expired');
  assert.strictEqual(roll.expiredTitle, 'Old Incident');
  assert.deepStrictEqual(roll.patch, {
    active: false,
    title: '',
    type: '',
    scope: '',
    impact: '',
    duration: 0,
    cooldown: 3,
    _retry: false,
    _retryType: ''
  });
  assert.strictEqual(randomFn.calls(), 0);
}

{
  const randomFn = seq([0.99]);
  const roll = DiceEngine.rollTrigger(config, {
    active: false,
    cooldown: 0,
    title: 'Retry placeholder',
    _retry: true,
    _retryType: 'a'
  }, randomFn);
  assert.strictEqual(roll.kind, 'retry');
  assert.strictEqual(roll.triggered, true);
  assert.strictEqual(roll.incidentType, 'a');
  assert.strictEqual(roll.incidentLabel, 'Type A');
  assert.strictEqual(roll.patch._retry, false);
  assert.strictEqual(roll.patch._retryType, '');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(roll.patch, 'title'), false);
  assert.strictEqual(randomFn.calls(), 1);
}

console.log('DiceEngine trigger tests: 6 passed');
