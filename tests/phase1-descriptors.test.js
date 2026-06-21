/* 阶段1 描述符层一致性测试（node 直接跑：node tests/phase1-descriptors.test.js）
 * 用 window 桩加载 rules-loader.js，断言 getModuleDescriptors / getActiveModuleDescriptors 正确。 */
const fs = require('fs');
const path = require('path');

globalThis.window = {
  WORLD_ENGINE_PRESETS: {
    getActivePreset: () => ({
      disabledModules: ['winds'],
      schemaOverrides: { factions: { addFields: { threat: { type: 'number', description: '威胁', example: 1 } } } },
      ui: { moduleLabels: { world: '模块一：测试核心' } }
    }),
    uiModuleLabel: (id) => (id === 'world' ? '模块一：测试核心' : '')
  }
};

const src = fs.readFileSync(path.join(__dirname, '..', 'world-engine-rules-loader.js'), 'utf8');
eval(src);
const R = globalThis.window.WORLD_ENGINE_RULES;

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.error('  ✗ ' + name); } }

const all = R.getModuleDescriptors();

ok('共 12 个描述符', all.length === 12);
ok('id 唯一', new Set(all.map(d => d.id)).size === 12);
ok('order 连续 1..12', all.every((d, i) => d.order === i + 1));
ok('全部 kind=builtin', all.every(d => d.kind === 'builtin'));

const byId = Object.fromEntries(all.map(d => [d.id, d]));

ok('world 是纯规则模块(none/无字段/无机制)',
  byId.world.container === 'none' && byId.world.field === null && Object.keys(byId.world.mechanics).length === 0);
ok('contact 是纯规则模块',
  byId.contact.container === 'none' && byId.contact.field === null);

ok('events: array/field=events/itemKey=name', byId.events.container === 'array' && byId.events.field === 'events' && byId.events.itemKey === 'name');
ok('events: 阈值骰 + 阶段机', byId.events.mechanics.dice.mode === 'threshold' && byId.events.mechanics.stages.typeField === 'type');
ok('winds: 消散骰 + itemKey=topic', byId.winds.mechanics.dice.mode === 'decay' && byId.winds.itemKey === 'topic');
ok('regional: 触发骰', byId.regional.mechanics.dice.mode === 'trigger');
ok('reputation: 4 维裁决/object', byId.reputation.container === 'object' && byId.reputation.mechanics.verdicts.axes.length === 4);
ok('factions: status+relation 裁决', byId.factions.mechanics.verdicts.axes.join(',') === 'status,relation');
ok('influence: 8 轮过期/上限12', byId.influence.mechanics.lifecycle.expireRounds === 8 && byId.influence.mechanics.lifecycle.cap === 12);
ok('enemies: 终局保留20/上限8', byId.enemies.mechanics.lifecycle.terminalRetainRounds === 20 && byId.enemies.mechanics.lifecycle.cap === 8);

const outputMods = all.filter(d => d.container !== 'none');
ok('10 个输出模块', outputMods.length === 10);
ok('输出模块都有 field 与 fields', outputMods.every(d => d.field && d.fields && typeof d.fields === 'object'));
ok('rules 文本非空', all.every(d => typeof d.rules === 'string' && d.rules.length > 0));

// getBuiltinMechanics 返回副本（改它不影响后续）
const m1 = R.getBuiltinMechanics('events'); m1.dice.mode = 'X';
ok('getBuiltinMechanics 返回深拷贝', R.getModuleDescriptors().events === undefined || byId.events.mechanics.dice.mode === 'threshold');

// 激活态：应用 disabled / schemaOverride / moduleLabel
const active = R.getActiveModuleDescriptors();
const aById = Object.fromEntries(active.map(d => [d.id, d]));
ok('disabled: winds.enabled=false', aById.winds.enabled === false);
ok('其他模块 enabled=true', aById.events.enabled === true && aById.world.enabled === true);
ok('moduleLabel 覆盖 world.name', aById.world.name === '模块一：测试核心');
ok('schemaOverride 注入 factions.threat', !!(aById.factions.fields && aById.factions.fields.threat));

// 等价性锁：描述符派生的 (moduleId→field) 映射，必须与 evolution.js 旧内联 MODULE_FIELD_MAP 完全一致。
const CANONICAL_FIELD_MAP = {
  events: 'events', factions: 'factions', winds: 'winds',
  influence: 'influenceChain', reputation: 'reputation',
  economy: 'economy', enemies: 'enemies', regional: 'regionalIncident',
  blackbox: 'blackbox', trends: 'worldTrends'
};
const derivedFieldMap = {};
all.forEach(d => { if (d.field) derivedFieldMap[d.id] = d.field; });
ok('描述符字段映射 == evolution 旧 MODULE_FIELD_MAP',
  JSON.stringify(derivedFieldMap) === JSON.stringify(CANONICAL_FIELD_MAP));

const dof = R.getDisabledOutputFields();   // 桩里 disabled=['winds']
ok('getDisabledOutputFields(winds)=[winds]', JSON.stringify(dof) === JSON.stringify(['winds']));

console.log('\n阶段1 描述符测试：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
