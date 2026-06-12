// world-engine.js — 主入口：加载模块，绑定事件，注入推演
(function() {
  if (window.__WORLD_ENGINE_LOADED__) return;
  window.__WORLD_ENGINE_LOADED__ = true;

  const MODULES = [
    'world-engine-core.js',
    'world-engine-api.js',
    'world-engine-rules-loader.js',
    'world-engine-worldbook.js',
    'world-engine-ledger.js',
    'world-engine-evolution.js',
    'world-engine-inject.js',
    'world-engine-ui.js'
  ];

  function getBaseUrl() {
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const src = scripts[i].src;
      if (src && src.includes('world-engine.js')) {
        return src.substring(0, src.lastIndexOf('/'));
      }
    }
    return './plugins/world-engine';
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('加载失败: ' + src));
      document.head.appendChild(s);
    });
  }

  async function init() {
    const baseUrl = getBaseUrl();
    console.log('[世界引擎] 加载中...');

    try {
      for (const mod of MODULES) {
        await loadScript(baseUrl + '/' + mod);
        console.log('[世界引擎] 已加载:', mod);
      }

      const core = window.WORLD_ENGINE_CORE;
      const ledger = window.WORLD_ENGINE_LEDGER;
      const evolution = window.WORLD_ENGINE_EVOLUTION;
      const inject = window.WORLD_ENGINE_INJECT;
      const ui = window.WORLD_ENGINE_UI;
      const rulesLoader = window.WORLD_ENGINE_RULES;

      // 加载活体引擎全部规则（规则已内置在 JS 中，不需要网络请求）
      let rulesCount = 0;
      try {
        const result = await rulesLoader.loadRules();
        rulesCount = result.count || 0;
        console.log('[世界引擎] 📜 活体引擎规则就绪，共', rulesCount, '条');
      } catch(e) {
        console.warn('[世界引擎] 规则加载异常（非致命）:', e.message);
      }

      let isEvolving = false;
      let autoEvolveTimer = null;
      let lastProcessedMessageKey = '';
      const AUTO_EVOLVE_DELAY = 1500;

      // ========== 注入管理 ==========
      const INJECTION_NAME = 'world-engine-world';

      // position=2 为 in-chat（插入聊天流），depth=1 为用户消息正前一位
      const INJ_POSITION = 2;
      const INJ_DEPTH = 1;

      function registerInjection(content) {
        try {
          const ctx = SillyTavern.getContext();
          // setExtensionPrompt 是最通用的方式，优先使用
          if (typeof ctx.setExtensionPrompt === 'function') {
            ctx.setExtensionPrompt(INJECTION_NAME, content, INJ_POSITION, INJ_DEPTH);
            return true;
          }
          // 新版 ST: registerInjection
          if (typeof ctx.registerInjection === 'function') {
            if (typeof ctx.unregisterInjection === 'function') {
              ctx.unregisterInjection(INJECTION_NAME);
            }
            ctx.registerInjection(INJECTION_NAME, content, { position: INJ_POSITION, depth: INJ_DEPTH, role: 'system' });
            return true;
          }
          // 旧版 ST: extensionPrompts 数组
          if (Array.isArray(ctx.extensionPrompts)) {
            ctx.extensionPrompts = ctx.extensionPrompts.filter(p => p.name !== INJECTION_NAME);
            ctx.extensionPrompts.push({
              name: INJECTION_NAME, content,
              role: 'system', position: INJ_POSITION, depth: INJ_DEPTH
            });
            return true;
          }
          console.warn('[世界引擎] 所有注入方式均不可用');
          return false;
        } catch(e) {
          console.error('[世界引擎] 注入失败', e);
          return false;
        }
      }

      function unregisterInjection() {
        try {
          const ctx = SillyTavern.getContext();
          if (typeof ctx.setExtensionPrompt === 'function') {
            ctx.setExtensionPrompt(INJECTION_NAME, '', INJ_POSITION, INJ_DEPTH);
          } else if (typeof ctx.unregisterInjection === 'function') {
            ctx.unregisterInjection(INJECTION_NAME);
          } else if (Array.isArray(ctx.extensionPrompts)) {
            ctx.extensionPrompts = ctx.extensionPrompts.filter(p => p.name !== INJECTION_NAME);
          }
        } catch(e) {}
      }

      // ========== 注入世界状态到正文 prompt ==========
      function applyInjection() {
        try {
          const ctx = SillyTavern.getContext();
          if (!ctx) return;
          const state = core.loadState();
          const currentRound = state.round;

          const chatHistory = ctx.chat || [];
          const recentChat = chatHistory.slice(-5);
          const recent = recentChat.map(m => (m.mes || '')).join(' ');

          const tags = [];
          const namePattern = /([一-龥]{2,4})(?:说|道|讲|问|答)/g;
          let m;
          while ((m = namePattern.exec(recent)) !== null) {
            if (!['什么','怎么','这个','那个','没有','可以','知道','但是','因为','所以'].includes(m[1])) {
              tags.push(m[1]);
            }
          }
          for (const ev of state.events || []) tags.push(ev.name);
          for (const f of state.factions || []) tags.push(f.name);

          const context = inject.buildContext(state, tags);

          state.lastInjection = { timestamp: Date.now(), round: currentRound, context, tagsUsed: tags };
          core.saveState(state);

          registerInjection(context);
          console.log(`[世界引擎] 注入完成 (round ${currentRound}, ${context.length} chars)`);
        } catch(e) {
          console.error('[世界引擎] 注入处理失败', e);
        }
      }

      // ========== 收到完整回复后：世界推演 + 记录账本 ==========
      function getMessageKey(ctx, chat, message) {
        const messageId = message?.mesId ?? message?.message_id ?? message?.send_date ?? (chat.length - 1);
        const swipeId = message?.swipe_id ?? message?.swipeId ?? '';
        return [core.getChatId(), chat.length - 1, messageId, swipeId].join('|');
      }

      function clearAutoEvolveTimer() {
        if (autoEvolveTimer) {
          clearTimeout(autoEvolveTimer);
          autoEvolveTimer = null;
        }
      }

      function onMessageReceived() {
        clearAutoEvolveTimer();

        const ctx = SillyTavern.getContext();
        const chat = ctx?.chat || [];
        const lastMsg = chat[chat.length - 1];
        const aiMsg = !lastMsg?.is_user ? (lastMsg?.mes || '').trim() : '';
        if (!ctx || chat.length <= 2 || !lastMsg || lastMsg.is_user || !aiMsg) return;

        const messageKey = getMessageKey(ctx, chat, lastMsg);
        autoEvolveTimer = setTimeout(
          () => runAutoEvolution(messageKey, aiMsg),
          AUTO_EVOLVE_DELAY
        );
      }

      async function runAutoEvolution(expectedKey, expectedText) {
        autoEvolveTimer = null;
        if (isEvolving || lastProcessedMessageKey === expectedKey) return;

        const ctx = SillyTavern.getContext();
        const chat = ctx?.chat || [];
        const lastMsg = chat[chat.length - 1];
        const aiMsg = !lastMsg?.is_user ? (lastMsg?.mes || '').trim() : '';
        if (!ctx || !lastMsg || lastMsg.is_user || !aiMsg) return;

        const currentKey = getMessageKey(ctx, chat, lastMsg);
        if (currentKey !== expectedKey) return;
        if (aiMsg !== expectedText) {
          onMessageReceived();
          return;
        }

        isEvolving = true;
        try {
          const state = core.loadState();
          if (window.__WE_SetExternalStatus) window.__WE_SetExternalStatus('⏳ 推演中...');
          if (ui && ui.setEvolvingUI) ui.setEvolvingUI(true);

          const success = await evolution.evolve(state, '', aiMsg);
          if (success) {
            lastProcessedMessageKey = currentKey;
            ledger.recordChanges(state);
            applyInjection();
            console.log('[世界引擎] ✅ 推演完成，当前第', state.round, '轮');
          } else {
            console.warn('[世界引擎] ⚠️ 推演失败或已中止');
          }
          if (window.__WE_SetExternalStatus) window.__WE_SetExternalStatus(success ? '✅ 推演完成' : '❌ 推演失败或已中止', !success);
        } catch(e) {
          console.error('[世界引擎] 处理失败', e);
          if (window.__WE_SetExternalStatus) window.__WE_SetExternalStatus('❌ 推演异常: ' + e.message, true);
        } finally {
          isEvolving = false;
          if (ui) { ui.setEvolvingUI(false); ui.refresh(); }
        }
      }

      async function onChatLoaded() {
        clearAutoEvolveTimer();
        const ctx = SillyTavern.getContext();
        const chat = ctx?.chat || [];
        if (chat.length === 0) {
          const state = core.loadState();
          state.round = 0;
          core.saveState(state);
          core.clearCheckpoint();
        }
        applyInjection();
        console.log('[世界引擎] 聊天已加载，注入已更新');
      }

      function onMessageSwiped() {
        clearAutoEvolveTimer();
      }

      // ========== 事件绑定 ==========
      const ctx = SillyTavern.getContext();
      if (ctx && ctx.eventSource) {
        const autoEvolveEvent = ctx.event_types?.GENERATION_ENDED || ctx.event_types?.MESSAGE_RECEIVED || 'message_received';
        ctx.eventSource.on(autoEvolveEvent, onMessageReceived);
        ctx.eventSource.on(ctx.event_types?.CHAT_LOADED || 'chat_loaded', onChatLoaded);
        ctx.eventSource.on(ctx.event_types?.MESSAGE_SWIPED || 'message_swiped', onMessageSwiped);
        console.log('[世界引擎] 事件绑定成功，自动推演事件:', autoEvolveEvent);
      } else {
        console.warn('[世界引擎] 无法绑定事件');
      }

      // 初始化时立即注入当前世界状态
      applyInjection();
      // 暴露 applyInjection 供手动推演调用
      window.WORLD_ENGINE = { applyInjection };

      // ========== 添加面板入口按钮到酒馆输入栏 ==========
      // 已移至 world-engine-ui.js 的 buildInputButton()

      ui.buildPanel();
      ui.buildInputButton();
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => ui.buildInputButton());
      }

      // 每隔 30 秒自动刷新面板（如果可见）
      setInterval(() => { if (ui) ui.refresh(); }, 30000);

      console.log('[世界引擎] 初始化完成 ✅');
    } catch(err) {
      console.error('[世界引擎] 初始化失败', err);
    }
  }

  init();
})();
