// 首楼为 AI 开场白（移植上游 48ea4b9 的世界侧）：推演读取对话时默认忽略第 0 层
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const main = fs.readFileSync(path.join(__dirname, '..', 'world-engine.js'), 'utf8');
const src = main.match(/function buildDialogueText\([\s\S]*?\n {6}}\n/);
assert(src, '应找到 buildDialogueText');
const core = { filterDialogue: (text) => text };
const buildDialogueText = new Function('core', src[0] + '\nreturn buildDialogueText;')(core);

const chat = [
  { is_user: false, mes: '开场白：宇宙历796年2月，第二舰队旗舰帕特洛克罗斯。' },
  { is_user: true, mes: '我走上舰桥报到。' },
  { is_user: false, mes: '值班参谋抬头看了你一眼。' }
];

// 默认（未设置）＝开启：读取窗口覆盖整段时也不读入第 0 层
let text = buildDialogueText(chat, 5, {});
assert(!text.includes('开场白'), '默认应忽略第 0 层开场白');
assert(text.includes('我走上舰桥报到'));
assert(text.includes('值班参谋'));

text = buildDialogueText(chat, 5, { firstLayerIsAiOpening: true });
assert(!text.includes('开场白'));

// 关闭后第 0 层按普通对话参与
text = buildDialogueText(chat, 5, { firstLayerIsAiOpening: false });
assert(text.includes('开场白'), '关闭后应读入第 0 层');

// 读取窗口本来就不到第 0 层时，结果与开关无关
assert.strictEqual(
  buildDialogueText(chat, 1, { firstLayerIsAiOpening: true }),
  buildDialogueText(chat, 1, { firstLayerIsAiOpening: false })
);

const api = fs.readFileSync(path.join(__dirname, '..', 'world-engine-api.js'), 'utf8');
assert(api.includes('firstLayerIsAiOpening: true'), '默认设置应开启首楼开场白');
const ui = fs.readFileSync(path.join(__dirname, '..', 'world-engine-ui.js'), 'utf8');
assert(ui.includes('id="we-first-layer-ai-opening"'), '设置 UI 缺少首楼开场白开关');
assert(ui.includes("firstLayerIsAiOpening: document.getElementById('we-first-layer-ai-opening')?.checked !== false"), '保存设置时应写入开关');

console.log('first-layer-opening tests: default skip / opt-out / window / settings passed');
