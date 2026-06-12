// world-engine-inject.js — 构建注入上下文（条件筛选，只注入影响RP的关键信息）
window.WORLD_ENGINE_INJECT = (function() {
  const core = window.WORLD_ENGINE_CORE;
  const ledger = window.WORLD_ENGINE_LEDGER;

  function buildContext(worldState, tags) {
    const rulesLoader = window.WORLD_ENGINE_RULES;
    const rulesSummary = rulesLoader ? rulesLoader.getCoreRulesSummary() : '';

    // 重大事件账本
    const ledgerText = ledger.buildLedgerText(worldState);

    // 事件链：Lv3/4 全注入，Lv1/2 仅已爆发/已完成终局注入
    const visibleEvents = (worldState.events || []).filter(e => {
      if (e.level >= 3) return true;
      return e.stage === '已爆发' || e.stage === '已完成';
    });
    const eventsText = visibleEvents.map(e => {
      const typeName = e.type === 'progress' ? '推进型' : '冲突型';
      let txt = `${e.name}(${typeName}, Lv.${e.level}) ${e.stage} ${e.stageRound||1}/9`;
      if (e.evolveResult) txt += ` [${e.evolveResult}]`;
      return txt;
    }).join('；') || '无';

    // 势力：排除友好/中立/冷淡，只注入极端关系
    const visibleFactions = (worldState.factions || []).filter(f =>
      !['友好','中立','冷淡'].includes(f.relation)
    );
    const factionsText = visibleFactions.map(f => {
      let txt = `${f.name}`;
      const parts = [];
      if (f.status) parts.push(`运势:${f.status}`);
      if (f.relation) parts.push(`关系:${f.relation}`);
      if (f.scope) parts.push(`范围:${f.scope}`);
      if (f.currentGoal) parts.push(`目标:${f.currentGoal}`);
      if (f.core_person) parts.push(`核心:${f.core_person}`);
      if (f.powerPillars?.length) parts.push(`支柱:${f.powerPillars.join('/')}`);
      return txt + '(' + parts.join(', ') + ')';
    }).join('；') || '无';

    // 风声：只注入 Lv3/4
    const windTypeNames = { announcement: '公告', report: '消息', rumor: '流言', sentiment: '舆情' };
    const visibleWinds = (worldState.winds || []).filter(w => (w.level || 0) >= 3);
    const windsText = visibleWinds.map(w =>
      `[${windTypeNames[w.type] || '风声'} Lv.${w.level || 1} ${w.scope || '?'}] ${w.content}`
    ).join('；') || '无';

    // 天下大势
    const trendsText = (worldState.worldTrends || []).filter(t => t.status !== '已结束').map(t =>
      `${t.name}（${t.scope || '天下'}）：${t.description}`
    ).join('；') || '无';

    // 声誉
    const rep = worldState.reputation || {};
    const repText = `朝堂:${rep.authority} 市井:${rep.common} 草莽:${rep.shadow} 同道:${rep.circuit}`;
    const repChange = rep.lastChange ? `（${rep.lastChange}）` : '';

    // 经济信号：全注入
    const econ = worldState.economy || {};
    const signalsText = (econ.signals || []).map(s => `${s.summary}（${s.scope}）`).join('；');
    const econText = `气候:${econ.climate||'平稳'}${signalsText ? '，信号:'+signalsText : ''}`;

    // 仇敌录
    let enemiesText = '无';
    if (worldState.enemies && worldState.enemies.length) {
      enemiesText = worldState.enemies.map(e =>
        `${e.name}（${e.type==='blood'?'血仇':'恩怨'}，${e.status}，原因：${e.reason}）`
      ).join('；');
    }

    // 区域突发事件
    const ri = worldState.regionalIncident || {};
    let riText = '';
    if (ri.active) {
      riText = `⚠️ ${ri.title || '区域突发事件'}（${ri.type || '?'}，${ri.scope || '?'}）— ${ri.impact || ''}`;
    } else {
      riText = ri.title && ri.title.includes('重试') ? `⚠️ ${ri.title}` : '本轮无区域突发事件';
    }

    // 信息黑盒：展示具体内容
    const blackbox = worldState.blackbox || {};
    const boxParts = [];
    if (blackbox.secretActions?.length) {
      const actionsText = blackbox.secretActions.map(a =>
        `[行为] ${a.action || '?'}（目击:${a.witnesses || '无'}）`
      ).join('；');
      boxParts.push(`隐秘行为(${blackbox.secretActions.length}): ${actionsText}`);
    }
    if (blackbox.secretAssets?.length) {
      const assetsText = blackbox.secretAssets.map(a =>
        `[资产] ${a.name || '?'}（暴露:${a.exposure || 0}%，${a.status || '有效'}）`
      ).join('；');
      boxParts.push(`隐秘资产(${blackbox.secretAssets.length}): ${assetsText}`);
    }
    const blackboxText = boxParts.length ? boxParts.join(' | ') : '无暗面信息';

    const context = `
【世界状态】
轮次：${worldState.round}
摘要：${worldState.worldDigest}
天下大势：${trendsText}
事件链：${eventsText}
势力：${factionsText}
风声：${windsText}
仇敌：${enemiesText}
声誉：${repText}${repChange}
经济：${econText}
区域事件：${riText}
黑盒：${blackboxText}

【近期重大事件账本】
${ledgerText}

【活体核心规则】
${rulesSummary}
    `.trim();

    return context.substring(0, 5000);
  }

  return { buildContext };
})();
