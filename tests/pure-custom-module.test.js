const assert = require('assert');
const fs = require('fs');
const path = require('path');

globalThis.window = {
  WORLD_ENGINE_PRESETS: {
    getActivePreset: () => ({ disabledModules: [], customRules: '' }),
    applyTermMap: (text) => text
  },
  WORLD_ENGINE_CORE: {
    renderUserName: (text) => text
  },
  WORLD_ENGINE_API: {}
};
globalThis.document = { addEventListener: () => {} };

const root = path.join(__dirname, '..');
eval(fs.readFileSync(path.join(root, 'world-engine-rules-loader.js'), 'utf8'));
eval(fs.readFileSync(path.join(root, 'world-engine-evolution.js'), 'utf8'));
eval(fs.readFileSync(path.join(root, 'world-engine-ui.js'), 'utf8'));

const R = window.WORLD_ENGINE_RULES;
const GenericMerge = window.WORLD_ENGINE_EVOLUTION._GENERIC_MERGE;
const renderGenericModule = window.WORLD_ENGINE_UI.__test.renderGenericModule;

const cultivation = {
  id: 'cultivation',
  name: '修为',
  kind: 'custom',
  order: 13,
  enabled: true,
  rules: '<cultivation>追踪角色修行境界、灵气积累与突破进度。</cultivation>',
  container: 'array',
  field: 'cultivation',
  itemKey: 'name',
  fields: {
    name: { type: 'string', label: '姓名', description: '修行者姓名。', example: '青岚' },
    realm: { type: 'enum', label: '境界', enum: ['炼气', '筑基'], description: '当前境界。', example: '筑基' },
    spiritQi: { type: 'number', label: '灵气', description: '灵气积累。', example: 42 },
    stage: { type: 'string', label: '阶段', description: '突破阶段。', example: '凝气' },
    progress: { type: 'number', label: '进度', description: '阶段进度。', example: 1 }
  },
  display: {
    style: 'cards',
    titleField: 'name',
    badgeFields: ['realm'],
    bodyFields: ['spiritQi', 'stage', 'progress'],
    emptyText: '暂无修为记录'
  },
  mechanics: {
    stages: {
      states: ['凝气', '破关', '稳固'],
      progressField: 'progress',
      progressMax: 3
    },
    verdicts: {
      axes: ['realm'],
      levels: ['炼气', '筑基']
    }
  }
};

{
  const text = R.buildRulesTextFromDescriptors([cultivation], { applyTerms: false, appendCustomRules: false });
  assert(text.includes('修为'));
  assert(text.includes('<cultivation>'));
}

{
  const schema = R.buildOutputSchemaFromDescriptor(cultivation);
  assert.strictEqual(schema.field, 'cultivation');
  assert.strictEqual(schema.container, 'array');
  assert.strictEqual(schema.fields.realm.example, '筑基');
}

{
  const state = { cultivation: [] };
  const update = {
    cultivation: [
      { name: '青岚', realm: '筑基', spiritQi: 64, stage: '未知阶段' }
    ]
  };
  assert.strictEqual(GenericMerge.merge(state, update, cultivation), true);
  assert.deepStrictEqual(state.cultivation, [
    { name: '青岚', realm: '筑基', spiritQi: 64, stage: '凝气', progress: 1 }
  ]);

  const html = renderGenericModule(cultivation, state, 'home');
  assert(html.includes('青岚'));
  assert(html.includes('筑基'));
  assert(html.includes('64'));
}

{
  const disabled = { ...cultivation, enabled: false };
  const text = R.buildRulesTextFromDescriptors([disabled], { applyTerms: false, appendCustomRules: false });
  assert(!text.includes('<cultivation>'));
  assert.strictEqual(R.buildOutputSchemaFromDescriptor(disabled), null);
  assert.strictEqual(GenericMerge.merge({ cultivation: [] }, { cultivation: [{ name: '青岚' }] }, disabled), false);
  assert.strictEqual(renderGenericModule(disabled, { cultivation: [{ name: '青岚' }] }, 'home'), '');
}

console.log('Pure custom module tests: 5 passed');
