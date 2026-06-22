const assert = require('assert');
const fs = require('fs');
const path = require('path');

globalThis.window = {
  WORLD_ENGINE_CORE: {},
  WORLD_ENGINE_API: {},
  WORLD_ENGINE_PRESETS: {
    _VERDICT_ENGINE: {
      normalizeSingleAxis(config, value, fallback) {
        const result = {};
        const levels = Array.isArray(config.levels) ? config.levels : [];
        levels.forEach(level => { result[level] = value && value[level] || fallback && fallback[level] || ''; });
        return result;
      }
    }
  }
};

const src = fs.readFileSync(path.join(__dirname, '..', 'world-engine-evolution.js'), 'utf8');
eval(src);

const GenericMechanics = globalThis.window.WORLD_ENGINE_EVOLUTION._GENERIC_MECHANICS;
const GenericMerge = globalThis.window.WORLD_ENGINE_EVOLUTION._GENERIC_MERGE;
assert(GenericMechanics && typeof GenericMechanics.rollDice === 'function', 'GenericMechanics should be exported for tests');

function seq(values) {
  let i = 0;
  return () => values[i++];
}

{
  const descriptor = {
    id: 'cultivation',
    field: 'cultivation',
    container: 'array',
    itemKey: 'name',
    enabled: true,
    mechanics: {
      stages: {
        states: ['seed', 'forming', 'complete'],
        terminalStates: ['complete'],
        progressField: 'progress',
        progressMax: 3
      },
      verdicts: {
        axes: ['realm'],
        levels: ['mortal', 'adept'],
        termMap: { adept: 'master' }
      }
    }
  };
  const state = { cultivation: [{ name: 'A', realm: 'mortal', stage: 'seed', progress: 1 }] };
  const update = { cultivation: [{ name: 'A', realm: 'master', stage: 'unknown' }, { name: 'B', realm: 'invalid' }] };
  assert.strictEqual(GenericMerge.merge(state, update, descriptor), true);
  assert.deepStrictEqual(state.cultivation, [
    { name: 'A', realm: 'adept', stage: 'seed', progress: 1 },
    { name: 'B', realm: 'mortal', stage: 'seed', progress: 1 }
  ]);
}

{
  const descriptor = {
    mechanics: {
      stages: {
        typeField: 'type',
        defaultType: 'quest',
        order: { quest: ['seed', 'forming', 'complete'] },
        finalStage: { quest: 'complete' },
        terminalStages: { quest: ['complete'] },
        progressField: 'progress',
        progressMax: 3
      },
      dice: {
        mode: 'threshold',
        base: { quest: { seed: 95 } },
        defaultBase: 95,
        setbackRatio: 0.4
      }
    }
  };
  const item = { type: 'quest', stage: 'seed', progress: 2, level: 1 };
  const roll = GenericMechanics.rollDice(descriptor, item, seq([0.99]));
  assert.strictEqual(roll.kind, 'success');
  GenericMechanics.applyDiceResult(descriptor, item, roll);
  assert.strictEqual(item.stage, 'forming');
  assert.strictEqual(item.progress, 1);
}

{
  const descriptor = {
    mechanics: {
      dice: {
        mode: 'decay',
        byTypeField: 'type',
        defaultType: 'rumor',
        quietField: 'quietRounds',
        table: { rumor: { base: 100, grace: 0, linear: 0, quadratic: 0 } }
      }
    }
  };
  const item = { type: 'rumor', level: 1, quietRounds: 0 };
  const roll = GenericMechanics.rollDice(descriptor, item, seq([0]));
  assert.strictEqual(roll.kind, 'decay');
  GenericMechanics.applyDiceResult(descriptor, item, roll);
  assert.strictEqual(item._decayed, true);
}

{
  const descriptor = {
    mechanics: {
      dice: {
        mode: 'trigger',
        chance: 1,
        durationRounds: 2,
        cooldownRounds: 3,
        typeWeights: [{ type: 'omen', label: 'Omen', weight: 1 }]
      }
    }
  };
  const item = { active: false, cooldown: 0 };
  const roll = GenericMechanics.rollDice(descriptor, item, seq([0, 0]));
  assert.strictEqual(roll.kind, 'hit');
  GenericMechanics.applyDiceResult(descriptor, item, roll);
  assert.strictEqual(item.active, true);
  assert.strictEqual(item.type, 'omen');
  assert.strictEqual(item.duration, 2);
}

{
  const descriptor = {
    mechanics: {
      verdicts: { axes: ['value'], levels: ['low', 'high'] }
    }
  };
  const result = GenericMechanics.normalizeVerdictTexts(descriptor, { high: 'Peak' }, { low: 'Base' });
  assert.deepStrictEqual(result, { low: 'Base', high: 'Peak' });
}

console.log('Generic mechanics tests: 5 passed');
