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
      let lastInjectedRound = -1;

      // ========== 注入管理 ==========
      const INJECTION_NAME = 'world-engine-world';

      function registerInjection(content) {
        try {
          const ctx = SillyTavern.getContext();
          // 新版 ST: registerInjection
          if (typeof ctx.registerInjection === 'function') {
            if (typeof ctx.unregisterInjection === 'function') {
              ctx.unregisterInjection(INJECTION_NAME);
            }
            ctx.registerInjection(INJECTION_NAME, content, { position: 'before', priority: 10 });
            return true;
          }
          // 中版 ST: setExtensionPrompt
          if (typeof ctx.setExtensionPrompt === 'function') {
            ctx.setExtensionPrompt(INJECTION_NAME, content, 'before', 10);
            return true;
          }
          // 旧版 ST: extensionPrompts 数组
          if (Array.isArray(ctx.extensionPrompts)) {
            ctx.extensionPrompts = ctx.extensionPrompts.filter(p => p.name !== INJECTION_NAME);
            ctx.extensionPrompts.push({
              name: INJECTION_NAME, content: content,
              role: 'system', position: 'before', priority: 10
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
          if (typeof ctx.unregisterInjection === 'function') {
            ctx.unregisterInjection(INJECTION_NAME);
          } else if (Array.isArray(ctx.extensionPrompts)) {
            ctx.extensionPrompts = ctx.extensionPrompts.filter(p => p.name !== INJECTION_NAME);
          }
        } catch(e) {}
      }

      // ========== 发送前注入（世界状态+记忆） ==========
      async function beforeMessageSend() {
        try {
          const ctx = SillyTavern.getContext();
          if (!ctx) return;
          const state = core.loadState();
          const currentRound = state.round;
          if (lastInjectedRound === currentRound) return;
          lastInjectedRound = currentRound;

          // 构建标签（从聊天历史和状态提取）
          const chatHistory = ctx.chat || [];
          const recentChat = chatHistory.slice(-5);
          const chatText = recentChat.map(m => m.mes || '').join(' ');
          const recent = recentChat.map(m => (m.mes || '')).join(' ');

          // 从聊天消息中提取实体名做标签
          const tags = [];
          const namePattern = /([一-龥]{2,4})(?:说|道|讲|问|答)/g;
          let m;
          while ((m = namePattern.exec(recent)) !== null) {
            if (!['什么','怎么','这个','那个','没有','可以','知道','但是','因为','所以'].includes(m[1])) {
              tags.push(m[1]);
            }
          }
          // 从状态中加事件和势力相关标签
          for (const ev of state.events || []) tags.push(ev.name);
          for (const f of state.factions || []) tags.push(f.name);

          const context = inject.buildContext(state, tags);

          // 保存注入记录供调试
          state.lastInjection = {
            timestamp: Date.now(),
            round: currentRound,
            context: context,
            tagsUsed: tags
          };
          core.saveState(state);

          registerInjection(context);
          console.log(`[世界引擎] 注入完成 (round ${currentRound}, ${context.length} chars)`);
        } catch(e) {
          console.error('[世界引擎] 注入处理失败', e);
        }
      }

      // ========== 收到回复后：世界推演 + 记录账本 ==========
      async function onMessageReceived() {
        if (isEvolving) return;
        isEvolving = true;

        try {
          const ctx = SillyTavern.getContext();
          if (!ctx) { isEvolving = false; return; }
          const state = core.loadState();
          const chat = ctx.chat || [];
          if (chat.length <= 2) {
            isEvolving = false;
            return;
          }

          const lastMsg = chat[chat.length - 1];
          const userMsg = lastMsg?.is_user ? (lastMsg.mes || '') : '';
          const aiMsg = !lastMsg?.is_user ? (lastMsg?.mes || '') : '';

          // 显示推演中
          if (window.__WE_SetExternalStatus) window.__WE_SetExternalStatus('⏳ 推演中...');

          // 1. 世界推演
          const success = await evolution.evolve(state, userMsg, aiMsg);

          // 2. API 返回后记录账本（对比存档点与推演后状态）
          if (success) ledger.recordChanges(state);

          // 3. API 返回后刷新 UI 并显示状态
          if (ui) ui.refresh();
          if (window.__WE_SetExternalStatus) window.__WE_SetExternalStatus(success ? '✅ 推演完成' : '❌ 推演失败', !success);

          if (success) {
            console.log('[世界引擎] ✅ 推演完成，当前第', state.round, '轮');
          } else {
            console.warn('[世界引擎] ⚠️ 推演失败');
          }
        } catch(e) {
          console.error('[世界引擎] 处理失败', e);
          if (window.__WE_SetExternalStatus) window.__WE_SetExternalStatus('❌ 推演异常: ' + e.message, true);
        } finally {
          isEvolving = false;
        }
      }

      async function onChatLoaded() {
        const ctx = SillyTavern.getContext();
        const chat = ctx?.chat || [];
        if (chat.length === 0) {
          const state = core.loadState();
          state.round = 0;
          core.saveState(state);
          core.clearCheckpoint();
        }
        lastInjectedRound = -1;
        unregisterInjection();
        console.log('[世界引擎] 聊天已加载');
      }

      function onMessageSwiped() {
        lastInjectedRound = -1;
      }

      // ========== 事件绑定 ==========
      const ctx = SillyTavern.getContext();
      if (ctx && ctx.eventSource) {
        ctx.eventSource.on(ctx.event_types?.MESSAGE_SENT || 'message_sent', beforeMessageSend);
        ctx.eventSource.on(ctx.event_types?.MESSAGE_RECEIVED || 'message_received', onMessageReceived);
        ctx.eventSource.on(ctx.event_types?.CHAT_LOADED || 'chat_loaded', onChatLoaded);
        ctx.eventSource.on(ctx.event_types?.MESSAGE_SWIPED || 'message_swiped', onMessageSwiped);
        console.log('[世界引擎] 事件绑定成功');
      } else {
        console.warn('[世界引擎] 无法绑定事件');
      }

      // ========== 添加面板入口按钮到酒馆输入栏 ==========
      function addPanelButton() {
        const selectors = ['#quickReplyBlock', '#send_but'];
        let container = null;
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) { container = el; break; }
        }
        if (!container) return;
        if (container.id === 'send_but') container = container.parentNode;
        if (document.getElementById('we-input-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'we-input-btn';
        btn.type = 'button';
        btn.className = 'menu_button interactable';
        btn.innerHTML = '<i class="fa-solid fa-earth-asia"></i>';
        btn.title = '世界引擎';
        Object.assign(btn.style, {
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 4px', padding: '4px 8px', cursor: 'pointer'
        });
        btn.addEventListener('click', () => {
          window.WORLD_ENGINE_UI.buildPanel();
          window.WORLD_ENGINE_UI.togglePanel();
        });
        container.appendChild(btn);

        // 外部状态指示器（面板关闭时也能看到推演状态）
        const statusIndicator = document.createElement('span');
        statusIndicator.id = 'we-external-status';
        container.appendChild(statusIndicator);

        window.__WE_SetExternalStatus = function(text, isError) {
          const el = document.getElementById('we-external-status');
          if (!el) return;
          el.textContent = text;
          el.className = 'we-external-status' + (isError ? ' error' : '');
          if (!isError && text.includes('完成')) {
            setTimeout(() => {
              if (el) { el.textContent = ''; el.className = 'we-external-status'; }
            }, 3000);
          }
        };
      }

      // 先构建面板（隐藏），再添加按钮
      ui.buildPanel();
      // 默认面板隐藏，由按钮点击切换
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addPanelButton);
      } else {
        addPanelButton();
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
