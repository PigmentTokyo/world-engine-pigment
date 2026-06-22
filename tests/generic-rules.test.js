const assert = require('assert');
const fs = require('fs');
const path = require('path');

globalThis.window = {
  WORLD_ENGINE_PRESETS: {
    getActivePreset: () => ({ disabledModules: [], customRules: '' }),
    uiModuleLabel: () => '',
    applyTermMap: (text) => text
  }
};

const src = fs.readFileSync(path.join(__dirname, '..', 'world-engine-rules-loader.js'), 'utf8');
eval(src);
const R = globalThis.window.WORLD_ENGINE_RULES;

assert(R && typeof R.buildRulesTextFromDescriptors === 'function', 'generic rule builder should be exported');

const text = R.buildRulesTextFromDescriptors([
  {
    id: 'cultivation',
    name: '模块十三：修为',
    kind: 'custom',
    order: 13,
    enabled: true,
    rules: '<cultivation>\n修为会随闭关、斗法和资源变化。\n</cultivation>'
  },
  {
    id: 'disabled_custom',
    name: '模块十四：禁用模块',
    kind: 'custom',
    order: 14,
    enabled: false,
    rules: '<disabled>不应进入 prompt</disabled>'
  }
], { applyTerms: false, appendCustomRules: false });

assert(text.includes('世界推演规则（原文，共1条）'));
assert(text.includes('模块十三：修为'));
assert(text.includes('修为会随闭关'));
assert(!text.includes('禁用模块'));
assert(!text.includes('不应进入 prompt'));


assert(typeof R.buildOutputSchemaFromDescriptor === 'function', 'generic output schema builder should be exported');

const arraySchema = R.buildOutputSchemaFromDescriptor({
  id: 'cultivation',
  name: '模块十三：修为',
  order: 13,
  enabled: true,
  container: 'array',
  field: 'cultivation',
  description: '修为条目。',
  fields: {
    name: { type: 'string', description: '修行者名称。', example: '许青' },
    realm: { type: 'enum', description: '当前境界。', example: '筑基' }
  }
});
assert.strictEqual(arraySchema.field, 'cultivation');
assert.strictEqual(arraySchema.container, 'array');
assert.strictEqual(arraySchema.fields.realm.description, '当前境界。');

const objectSchema = R.buildOutputSchemaFromDescriptor({
  id: 'sectLedger',
  enabled: true,
  container: 'object',
  fields: { balance: { type: 'number', description: '宗门结余。', example: 42 } }
});
assert.strictEqual(objectSchema.field, 'sectLedger');
assert.strictEqual(objectSchema.container, 'object');
assert.strictEqual(objectSchema.fields.balance.example, 42);

const scalarSchema = R.buildOutputSchemaFromDescriptor({
  id: 'moonPhase',
  enabled: true,
  container: 'scalar',
  scalarType: 'string',
  example: '上弦月'
});
assert.strictEqual(scalarSchema.field, 'moonPhase');
assert.strictEqual(scalarSchema.container, 'scalar');
assert.strictEqual(scalarSchema.scalarType, 'string');

assert.strictEqual(R.buildOutputSchemaFromDescriptor({ id: 'off', enabled: false, container: 'object', fields: {} }), null);
console.log('Generic runtime descriptor tests: 2 passed');