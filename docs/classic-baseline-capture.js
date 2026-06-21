/* ============================================================
 * classic 回归基线捕获脚本（阶段 0）
 * ------------------------------------------------------------
 * 用途：在「改造前」与「改造后」各跑一次，对比两份 JSON。
 *       覆盖所有内置可确定性输出（注入规则全文 / 输出契约 / 示例 JSON /
 *       模块列表 / 激活 schema），遍历每个预设。这些都不依赖 LLM、不含随机，
 *       因此可逐字对比 —— 是阶段 1🔒「注入 prompt 一字不差」的判定依据。
 *
 * 用法：
 *   1. 打开 SillyTavern，确保世界引擎已加载（控制台能看到 window.WORLD_ENGINE_RULES）。
 *   2. 把本文件全部内容粘进浏览器控制台回车 → 自动下载 we-baseline-<时间>.json。
 *   3. 改造完成后再跑一次，得到第二份。
 *   4. 用 diff 工具（或 WE_BASELINE.diff(a,b)）对比；classic 相关字段必须为空 diff。
 *
 * 注意：动态演化（跑 3~5 轮、含骰子与 LLM）不在本脚本内 —— 那部分需手动游玩对照，
 *       或在阶段 2 把 randomFn 全部参数化后用固定种子复现。本脚本先锁死“静态契约”这条红线。
 * ============================================================ */
(function () {
  const R = window.WORLD_ENGINE_RULES;
  const P = window.WORLD_ENGINE_PRESETS;
  const C = window.WORLD_ENGINE_CORE;
  if (!R || !P) { console.error('[基线] 世界引擎未加载（WORLD_ENGINE_RULES / _PRESETS 缺失）'); return; }

  const safe = (fn) => { try { return fn(); } catch (e) { return { __error: String(e && e.message || e) }; } };

  function captureCurrent() {
    return {
      activePresetId: safe(() => P.getActivePresetId ? P.getActivePresetId() : (P.getActivePreset() || {}).id),
      ruleText:        safe(() => R.getAllRulesText && R.getAllRulesText()),
      coreSummary:     safe(() => R.getCoreRulesSummary && R.getCoreRulesSummary()),
      outputInstr:     safe(() => R.buildOutputInstructionsText && R.buildOutputInstructionsText()),
      outputExample:   safe(() => R.buildOutputExampleJSON && R.buildOutputExampleJSON()),
      moduleList:      safe(() => R.getModuleList && R.getModuleList()),
      activeSchemas:   safe(() => R.getActiveOutputSchemas && R.getActiveOutputSchemas()),
      disabledFields:  safe(() => R.getDisabledOutputFields && R.getDisabledOutputFields()),
      allowedFields:   safe(() => R.getAllowedOutputFields && R.getAllowedOutputFields())
    };
  }

  const out = { capturedAt: new Date().toISOString(), perPreset: {} };
  const originalId = safe(() => P.getActivePresetId ? P.getActivePresetId() : (P.getActivePreset() || {}).id);
  const presets = safe(() => P.getAllPresets ? P.getAllPresets() : []) || [];

  if (Array.isArray(presets) && presets.length && P.setActivePreset) {
    presets.forEach((pr) => {
      const id = pr && pr.id;
      if (!id) return;
      safe(() => P.setActivePreset(id));
      out.perPreset[id] = { name: pr.name, mode: pr.mode || 'classic', snapshot: captureCurrent() };
    });
    safe(() => P.setActivePreset(originalId)); // 还原
  } else {
    out.perPreset['__current__'] = { snapshot: captureCurrent() };
  }

  // 顺带存一份当前世界 state（动态对照用，仅供参考，不参与静态红线）
  out.currentState = safe(() => (C && C.hasState && C.hasState()) ? C.loadState() : null);

  const json = JSON.stringify(out, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'we-baseline-' + Date.now() + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  console.log('[基线] 已捕获 ' + Object.keys(out.perPreset).length + ' 个预设，文件已下载。');

  // 简易 diff：WE_BASELINE.diff(旧对象, 新对象) → 列出有差异的 (预设, 字段)
  window.WE_BASELINE = {
    last: out,
    diff(before, after) {
      const diffs = [];
      const ids = new Set([...Object.keys(before.perPreset || {}), ...Object.keys(after.perPreset || {})]);
      ids.forEach((id) => {
        const b = (before.perPreset[id] || {}).snapshot || {};
        const a2 = (after.perPreset[id] || {}).snapshot || {};
        const keys = new Set([...Object.keys(b), ...Object.keys(a2)]);
        keys.forEach((k) => {
          if (JSON.stringify(b[k]) !== JSON.stringify(a2[k])) diffs.push({ preset: id, field: k });
        });
      });
      if (!diffs.length) console.log('%c[基线] ✅ 零差异（classic 红线守住）', 'color:green');
      else console.warn('[基线] ⚠️ 差异项：', diffs);
      return diffs;
    }
  };
})();
