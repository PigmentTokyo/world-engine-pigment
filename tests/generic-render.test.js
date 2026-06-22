const assert = require('assert');
const fs = require('fs');
const path = require('path');

globalThis.document = { addEventListener: () => {} };

globalThis.window = {
  WORLD_ENGINE_CORE: {
    renderUserName: (text) => String(text == null ? '' : text),
    loadState: () => ({ round: 1 })
  },
  WORLD_ENGINE_EVOLUTION: {},
  WORLD_ENGINE_PRESETS: {
    uiLabel: (text) => text,
    uiPoem: () => '',
    uiMotto: () => '',
    uiMood: () => '',
    uiSummaryEmpty: () => ''
  }
};

const src = fs.readFileSync(path.join(__dirname, '..', 'world-engine-ui.js'), 'utf8');
eval(src);
const UI = globalThis.window.WORLD_ENGINE_UI;
assert(UI && UI.__test && typeof UI.__test.renderGenericModule === 'function', 'generic renderer should be exported for tests');
UI.__test.resetPager();

const state = {
  cultivation: [
    { name: '许青', realm: '筑基', spiritQi: 42 },
    { name: '阿蛮', realm: '炼气', spiritQi: 18 }
  ],
  sectLedger: { balance: 7, status: '平稳' },
  moonPhase: '上弦月'
};

const cards = UI.__test.renderGenericModule({
  id: 'cultivation', field: 'cultivation', container: 'array', itemKey: 'name', enabled: true,
  fields: {
    name: { label: '姓名', type: 'string' },
    realm: { label: '境界', type: 'string' },
    spiritQi: { label: '灵气', type: 'number' }
  },
  display: { style: 'cards', titleField: 'name', badgeFields: ['realm'], bodyFields: ['spiritQi'] }
}, state, 'test');
assert(cards.includes('许青'));
assert(cards.includes('筑基'));
assert(cards.includes('灵气'));

const table = UI.__test.renderGenericModule({
  id: 'cultivation', field: 'cultivation', container: 'array', enabled: true,
  fields: { name: { label: '姓名' }, realm: { label: '境界' } },
  display: { style: 'table', columns: ['name', 'realm'] }
}, state, 'test');
assert(table.includes('<table'));
assert(table.includes('阿蛮'));
assert(table.includes('境界'));

const keyvalue = UI.__test.renderGenericModule({
  id: 'sectLedger', container: 'object', enabled: true,
  fields: { balance: { label: '结余' }, status: { label: '状态' } },
  display: { style: 'keyvalue' }
}, state, 'test');
assert(keyvalue.includes('结余'));
assert(keyvalue.includes('平稳'));

const list = UI.__test.renderGenericModule({
  id: 'cultivation', field: 'cultivation', container: 'array', itemKey: 'name', enabled: true,
  display: { style: 'list', titleField: 'realm' }
}, state, 'test');
assert(list.includes('筑基'));
assert(list.includes('炼气'));

const scalar = UI.__test.renderGenericModule({
  id: 'moonPhase', container: 'scalar', enabled: true,
  display: { style: 'keyvalue' }
}, state, 'test');
assert(scalar.includes('上弦月'));

console.log('Generic render tests: 5 passed');