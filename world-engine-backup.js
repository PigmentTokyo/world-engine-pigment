// world-engine-backup.js — 本地滚动存档备份（防丢存档）。
// 跨设备同步已由 store→chat_metadata 镜像负责；本模块只解决“当前状态被覆盖/损坏后能回滚”。
// 每次推演成功后自动对全部 chat-scoped 槽位拍一份带时间戳的快照，存到「本地」键
// （world_engine_backups_<chatId>，不是 chat-scoped 槽位 → 不写进会同步的聊天文件，避免膨胀）。
// 提供列表 / 恢复 / 删除 / 清空，以及一份可嵌进设置页的 UI 片段 + 自挂的点击委托。
window.WORLD_ENGINE_BACKUP = (function () {
  'use strict';

  const LIMIT = 20;            // 每个聊天最多保留的快照数
  const LIST_PREFIX = 'world_engine_backups_';

  function store() { return window.WORLD_ENGINE_STORE; }
  function core() { return window.WORLD_ENGINE_CORE; }

  function getChatId() {
    try { return (core() && core().getChatId && core().getChatId()) || 'default'; }
    catch (e) { return 'default'; }
  }

  function getChatLayer() {
    try { const n = core() && core().getChatLayer && core().getChatLayer(); return Number.isFinite(Number(n)) ? Number(n) : null; }
    catch (e) { return null; }
  }

  // 与 world-engine-store.js getChatScopedSlot 的键方案保持一致：一份快照即这些槽位的原始字符串值。
  function slotKeys(chatId) {
    const p = 'world_engine_' + chatId;
    return {
      state: p,
      checkpoint: p + '_checkpoint',
      anchorLayer: p + '_anchorLayer',
      fingerprint: p + '_fingerprint',
      customModuleState: p + '_customModuleState',
      worldbookSelection: 'world_engine_worldbook_selection_' + chatId,
      tonePrompt: 'world_engine_tone_prompt_' + chatId
    };
  }

  function listKey(chatId) { return LIST_PREFIX + (chatId || getChatId()); }

  function readList(chatId) {
    try {
      const raw = store() && store().getItem(listKey(chatId));
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function writeList(chatId, arr) {
    try { store().setItem(listKey(chatId), JSON.stringify(arr)); return true; }
    catch (e) { console.warn('[世界引擎] 备份写入失败', e); return false; }
  }

  function parseRound(stateStr) {
    try { const s = JSON.parse(stateStr); return s && typeof s.round === 'number' ? s.round : null; }
    catch (e) { return null; }
  }

  // 拍快照。reason 仅作展示。返回新条目或 null（无 state 可备份 / 与上一份完全相同则跳过）。
  function snapshot(reason) {
    const s = store(); if (!s) return null;
    const chatId = getChatId();
    const keys = slotKeys(chatId);
    const data = {};
    let hasState = false;
    for (const slot in keys) {
      const v = s.getItem(keys[slot]);
      if (v != null) { data[slot] = String(v); if (slot === 'state') hasState = true; }
    }
    if (!hasState) return null; // 没有世界状态就没什么可保的

    const list = readList(chatId);
    // 去重：与最近一份的 state 完全一致则不重复拍（避免同一状态刷屏）
    if (list.length && list[list.length - 1].data && list[list.length - 1].data.state === data.state) {
      return null;
    }
    // ts 既是展示时间也是唯一标识：同毫秒内多次备份要保证单调递增，否则 restore/remove 会误伤同 ts 的多条
    let ts = Date.now();
    if (list.length && ts <= list[list.length - 1].ts) ts = list[list.length - 1].ts + 1;
    const entry = {
      ts: ts,
      reason: reason || 'auto',
      round: parseRound(data.state),
      layer: getChatLayer(),
      data: data
    };
    list.push(entry);
    while (list.length > LIMIT) list.shift(); // 滚动裁剪，留最新 LIMIT 份
    writeList(chatId, list);
    return entry;
  }

  // 返回轻量列表（不含 data），最新在前。
  function list(chatId) {
    return readList(chatId)
      .map(e => ({ ts: e.ts, reason: e.reason, round: e.round, layer: e.layer }))
      .sort((a, b) => b.ts - a.ts);
  }

  // 恢复某份快照：把每个槽位写回 store（setItem 会同时回写 chat_metadata → 同步生效）。
  function restore(ts) {
    const chatId = getChatId();
    const entry = readList(chatId).find(e => e.ts === Number(ts));
    if (!entry || !entry.data) return false;
    const keys = slotKeys(chatId);
    const s = store(); if (!s) return false;
    for (const slot in keys) {
      const key = keys[slot];
      if (entry.data[slot] != null) s.setItem(key, entry.data[slot]);
      else s.removeItem(key); // 当时不存在的槽位 → 清掉，精确还原
    }
    console.log('[世界引擎] ✅ 已恢复存档备份', new Date(entry.ts).toLocaleString());
    return true;
  }

  function remove(ts) {
    const chatId = getChatId();
    const arr = readList(chatId).filter(e => e.ts !== Number(ts));
    return writeList(chatId, arr);
  }

  function clear(chatId) {
    try { store().removeItem(listKey(chatId || getChatId())); return true; }
    catch (e) { return false; }
  }

  // ========== UI 片段（嵌入设置页“数据导入/导出”面板） ==========

  function fmtTime(ts) {
    try { return new Date(ts).toLocaleString(); } catch (e) { return String(ts); }
  }
  function esc(x) { return String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function renderListHtml() {
    const arr = list();
    if (!arr.length) return '<div class="we-empty">暂无自动备份（每次推演成功后自动生成）</div>';
    return arr.map(e => {
      const rnd = (e.round == null ? '?' : e.round);
      const lyr = (e.layer == null ? '-' : e.layer);
      const tag = e.reason === 'manual' ? '手动' : '自动';
      return '<div class="we-input-group" style="display:flex;align-items:center;gap:8px;justify-content:space-between;">'
        + '<div style="font-size:12px;line-height:1.4;">'
        + '<div>第 ' + rnd + ' 轮 · ' + lyr + ' 层 <span style="color:var(--we-text3);">(' + tag + ')</span></div>'
        + '<div style="color:var(--we-text3);font-size:11px;">' + esc(fmtTime(e.ts)) + '</div>'
        + '</div>'
        + '<div style="display:flex;gap:6px;flex:0 0 auto;">'
        + '<button class="we-btn we-btn-primary" data-we-backup-restore="' + e.ts + '">恢复</button>'
        + '<button class="we-btn we-btn-danger" data-we-backup-del="' + e.ts + '">删除</button>'
        + '</div></div>';
    }).join('');
  }

  function sectionBodyHtml() {
    return '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">'
      + '<button class="we-btn" id="we-backup-now">立即备份当前状态</button>'
      + '<button class="we-btn we-btn-danger" id="we-backup-clear">清空全部备份</button>'
      + '</div>'
      + '<div class="we-hint" style="margin-bottom:8px;">推演成功后自动备份；最多保留 ' + LIMIT + ' 份，仅存本地（不写入聊天文件）。恢复会覆盖当前世界状态。</div>'
      + '<div id="we-backup-list">' + renderListHtml() + '</div>';
  }

  function toast(msg) {
    try { if (window.toastr && window.toastr.info) { window.toastr.info(msg, '世界引擎'); return; } } catch (e) {}
    console.log('[世界引擎] ' + msg);
  }

  function refreshListDom() {
    const el = document.getElementById('we-backup-list');
    if (el) el.innerHTML = renderListHtml();
  }

  // 一次性文档级点击委托：处理本模块按钮，不依赖 ui.js 的绑定流程。
  function installDelegation() {
    if (window.__WE_BACKUP_DELEGATED__) return;
    window.__WE_BACKUP_DELEGATED__ = true;
    document.addEventListener('click', function (e) {
      const restoreBtn = e.target.closest && e.target.closest('[data-we-backup-restore]');
      if (restoreBtn) {
        const ts = restoreBtn.getAttribute('data-we-backup-restore');
        if (window.confirm('恢复这份备份会覆盖当前世界状态，确定？')) {
          if (restore(ts)) {
            toast('已恢复存档备份');
            try { window.WORLD_ENGINE_UI && window.WORLD_ENGINE_UI.refresh && window.WORLD_ENGINE_UI.refresh(true); } catch (_) {}
            try { window.WORLD_ENGINE && window.WORLD_ENGINE.applyInjection && window.WORLD_ENGINE.applyInjection(); } catch (_) {}
            refreshListDom();
          } else { toast('恢复失败：备份不存在'); }
        }
        return;
      }
      const delBtn = e.target.closest && e.target.closest('[data-we-backup-del]');
      if (delBtn) {
        const ts = delBtn.getAttribute('data-we-backup-del');
        remove(ts); refreshListDom(); return;
      }
      if (e.target.closest && e.target.closest('#we-backup-now')) {
        const entry = snapshot('manual');
        toast(entry ? '已备份当前状态' : '当前与最近一份相同 / 无状态可备份');
        refreshListDom(); return;
      }
      if (e.target.closest && e.target.closest('#we-backup-clear')) {
        if (window.confirm('清空当前聊天的全部备份？此操作不可撤销。')) { clear(); refreshListDom(); }
        return;
      }
    });
  }

  try { if (document && document.addEventListener) installDelegation(); } catch (e) {}

  return { snapshot, list, restore, remove, clear, renderListHtml, sectionBodyHtml, LIMIT };
})();
