// world-engine-api.js — 独立 API 调用（支持自定义 OpenAI 兼容 API）
window.WORLD_ENGINE_API = (function() {
  let cachedSettings = null;

  function getChatId() {
    try {
      if (window.WORLD_ENGINE_CORE && typeof window.WORLD_ENGINE_CORE.getChatId === 'function') {
        return window.WORLD_ENGINE_CORE.getChatId() || 'default';
      }
      const ctx = window.SillyTavern && typeof window.SillyTavern.getContext === 'function' ? window.SillyTavern.getContext() : null;
      return (ctx && (ctx.chatId || ctx.chat_id || ctx.chat)) || 'default';
    } catch (e) {
      return 'default';
    }
  }

  function getChatTonePrompt() {
    try {
      const store = window.WORLD_ENGINE_STORE;
      if (!store || typeof store.getItem !== 'function') return null;
      return store.getItem('world_engine_tone_prompt_' + getChatId());
    } catch (e) {
      return null;
    }
  }

  function setChatTonePrompt(text) {
    try {
      const store = window.WORLD_ENGINE_STORE;
      if (!store || typeof store.setItem !== 'function') return false;
      store.setItem('world_engine_tone_prompt_' + getChatId(), text || '');
      return true;
    } catch (e) {
      return false;
    }
  }

  function getSettings(forceRefresh) {
    if (forceRefresh) cachedSettings = null;
    if (cachedSettings) return cachedSettings;
    const defaults = {
      apiUrl: '',
      apiKey: '',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 2000,
      useStProxy: true,
      injectIntoPrompt: true,
      evolveMode: 'auto',
      evolveEveryX: 1,
      evolveReadRounds: 1,
      evolveFilterRegex: '',
      worldbookTrigger: false,
      tonePrompt: '',
      // 按时间推演模式
      evolveTimeFront: 0,
      evolveTimeBack: 80,
      evolveTimeRe1: '', evolveTimeRe2: '', evolveTimeRe3: '',
      evolveTimeRe4: '', evolveTimeRe5: '', evolveTimeRe6: '',
      evolveTimeMul1: 360, evolveTimeMul2: 30, evolveTimeMul3: 1,
      evolveTimeThreshold: 1,
      evolveTimeMaxRounds: 10
    };
    const raw = window.WORLD_ENGINE_STORE.getItem('world_engine_settings');
    let parsed = {};
    if (raw) {
      try { parsed = JSON.parse(raw) || {}; } catch(e) {}
    }
    cachedSettings = { ...defaults, ...parsed };
    const chatTonePrompt = getChatTonePrompt();
    if (chatTonePrompt !== null) {
      cachedSettings.tonePrompt = chatTonePrompt;
    } else if (typeof parsed.tonePrompt === 'string' && parsed.tonePrompt) {
      cachedSettings.tonePrompt = parsed.tonePrompt;
      if (setChatTonePrompt(parsed.tonePrompt)) {
        try {
          delete parsed.tonePrompt;
          window.WORLD_ENGINE_STORE.setItem('world_engine_settings', JSON.stringify(parsed));
        } catch (e) {}
      }
    }
    return cachedSettings;
  }

  function normalizeUrl(url) {
    let u = url.trim().replace(/\/+$/, '');
    if (!u) return '';
    if (u.endsWith('/chat/completions')) return u;
    // 已带版本前缀（/v1、/v3、/api/v3、/api/coding/v3 等）→ 只补 /chat/completions，不再硬塞 /v1；
    // 否则火山方舟等自定义版本前缀会被拼成 .../v3/v1/chat/completions 而 404。
    // 裸 host（无版本段）仍按 OpenAI 风格补 /v1/chat/completions，保持旧配置不破。
    if (/\/v\d+$/.test(u)) return u + '/chat/completions';
    return u + '/v1/chat/completions';
  }

  // API 基址（去掉末尾 /chat/completions），例如 https://host/v1
  function getApiBase(settings) {
    const u = normalizeUrl(settings.apiUrl);
    if (!u) return '';
    return u.replace(/\/chat\/completions$/, '');
  }

  // 是否可走 SillyTavern 后端转发（服务器对服务器，无浏览器 CORS）
  // 需同时满足：用户开关开启（默认开） + 处于酒馆环境
  function canUseStProxy() {
    try {
      if (getSettings().useStProxy === false) return false;
      return typeof SillyTavern !== 'undefined'
        && typeof SillyTavern.getContext === 'function'
        && typeof SillyTavern.getContext().getRequestHeaders === 'function';
    } catch (e) {
      return false;
    }
  }

  // 取 ST 的请求头（含 CSRF token）
  function getContextHeaders() {
    try {
      const ctx = SillyTavern.getContext();
      const h = ctx.getRequestHeaders();
      if (h && !h['Content-Type']) h['Content-Type'] = 'application/json';
      return h;
    } catch (e) {
      return { 'Content-Type': 'application/json' };
    }
  }

  function isMixedContent(url) {
    try {
      const target = new URL(url, window.location.href);
      return window.location.protocol === 'https:' && target.protocol === 'http:';
    } catch(e) {
      return false;
    }
  }

  function buildNetworkErrorMessage(error, url) {
    const message = error && error.message ? error.message : String(error || '');
    if (error && error.name === 'AbortError') {
      return 'API 请求已取消';
    }
    if (isMixedContent(url)) {
      return 'API 请求被浏览器拦截：当前页面是 HTTPS，但 API URL 是 HTTP。请改用 HTTPS 地址，或使用同源/后端代理。';
    }
    if (/Failed to fetch|NetworkError|Load failed|Network request failed/i.test(message)) {
      return [
        'API 请求没有成功发出或没有拿到响应。',
        '常见原因：API 服务未启动、地址/端口填错、浏览器 CORS 拦截、证书异常、本地代理拦截，或目标接口不允许网页直接调用。',
        '当前请求地址：' + url,
        '建议：优先把 API URL 换成允许浏览器跨域的 OpenAI 兼容代理；如果使用官方或中转接口，通常需要后端代理转发。'
      ].join('\n');
    }
    return message || 'API 网络请求失败';
  }

  async function fetchJson(url, options) {
    let resp;
    try {
      resp = await fetch(url, options);
    } catch(e) {
      throw new Error(buildNetworkErrorMessage(e, url));
    }

    if (!resp.ok) {
      let detail = '';
      try {
        const err = await resp.json();
        detail = err.error?.message || err.message || JSON.stringify(err);
      } catch(e) {
        try { detail = await resp.text(); } catch(e2) {}
      }
      throw new Error(`HTTP ${resp.status}: ${detail || resp.statusText || '请求失败'}`);
    }

    try {
      return await resp.json();
    } catch(e) {
      throw new Error('API 返回不是有效 JSON: ' + (e.message || e));
    }
  }

  /**
   * 调用独立 API（非酒馆自带），OpenAI 兼容格式
   */
  async function callApi(prompt, maxTokens, temperature, signal) {
    try {
      const _core = window.WORLD_ENGINE_CORE;
      if (_core && typeof _core.substituteMacros === 'function') prompt = _core.substituteMacros(prompt);
    } catch (e) {}
    const settings = getSettings();
    const url = normalizeUrl(settings.apiUrl);
    if (!url) throw new Error('未配置 API URL，请在设置中填写');

    const resolvedMaxTokens = Number(maxTokens ?? settings.maxTokens ?? 2000);
    const resolvedTemperature = Number(temperature ?? settings.temperature ?? 0.7);
    const model = settings.model || 'gpt-3.5-turbo';
    const messages = [{ role: 'user', content: prompt }];
    const temp = Number.isFinite(resolvedTemperature) ? resolvedTemperature : 0.7;
    const maxTok = Number.isFinite(resolvedMaxTokens) ? resolvedMaxTokens : 2000;

    let data;
    if (canUseStProxy()) {
      // 经由 SillyTavern 后端转发（服务器对服务器，无浏览器 CORS）
      const base = getApiBase(settings);
      console.log('[世界引擎] 调用 API（经 ST 后端转发）:', base, model);
      data = await fetchJson('/api/backends/chat-completions/generate', {
        method: 'POST',
        headers: getContextHeaders(),
        body: JSON.stringify({
          chat_completion_source: 'openai',
          reverse_proxy: base,
          proxy_password: settings.apiKey || '',
          model: model,
          messages: messages,
          temperature: temp,
          max_tokens: maxTok,
          stream: false
        }),
        signal: signal || null
      });
      if (data && data.error) {
        throw new Error('SillyTavern 后端转发失败：' + (data.message || '无法连接到目标 API，请检查 API URL、密钥或中转是否可用'));
      }
    } else {
      // 回退：浏览器直连（非酒馆环境/独立运行，会受 CORS 限制）
      const headers = { 'Content-Type': 'application/json' };
      if (settings.apiKey) headers['Authorization'] = 'Bearer ' + settings.apiKey;
      console.log('[世界引擎] 调用 API（浏览器直连）:', url, model);
      data = await fetchJson(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ model: model, messages: messages, temperature: temp, max_tokens: maxTok }),
        signal: signal || null
      });
    }

    const choice = data.choices?.[0];
    if (!choice) throw new Error('API 返回缺少 choices[0]');
    if (choice.finish_reason === 'length') {
      console.warn('[世界引擎] API 输出达到长度上限，将读取截断前已完整返回的字段');
    }
    return choice.message?.content || '';
  }

  function repairTruncatedJSON(content) {
    const rootStart = content.indexOf('{');
    if (rootStart === -1) return null;

    const stack = [];
    const candidates = [];
    let inString = false;
    let escaped = false;

    for (let i = rootStart; i < content.length; i++) {
      const char = content[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
      } else if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}' || char === ']') {
        stack.pop();
      } else if (char === ',' && stack.length > 0) {
        candidates.push({
          end: i,
          suffix: stack.slice().reverse().map(open => open === '{' ? '}' : ']').join('')
        });
      }
    }

    for (let i = candidates.length - 1; i >= 0; i--) {
      const candidate = content.slice(rootStart, candidates[i].end) + candidates[i].suffix;
      try {
        return JSON.parse(candidate);
      } catch(e) {}
    }
    return null;
  }

  /**
   * 解析 API 返回的 JSON（容错处理）
   */
  function parseJSON(text) {
    let content = String(text || '').trim();
    content = content.replace(/^```json\s*/i, '').replace(/\s*```\s*$/, '').trim();
    try {
      return JSON.parse(content);
    } catch(e) {}

    // 从夹杂说明、思考文本或多个代码块的返回中提取顶层 JSON；
    // 模型的最终答案通常位于最后，因此采用最后一个有效对象。
    let depth = 0;
    let start = -1;
    let inString = false;
    let escaped = false;
    let result = null;
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
      } else if (char === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (char === '}' && depth > 0) {
        depth--;
        if (depth === 0 && start !== -1) {
          try {
            result = JSON.parse(content.slice(start, i + 1));
          } catch(e2) {}
          start = -1;
        }
      }
    }
    return result || repairTruncatedJSON(content);
  }

  /**
   * 获取模型列表（OpenAI 兼容格式）
   */
  async function fetchModelList() {
    const settings = getSettings();
    const base = getApiBase(settings);
    if (!base) throw new Error('未配置 API URL，请在设置中填写');

    if (canUseStProxy()) {
      // 经由 SillyTavern 后端拉取模型列表（无浏览器 CORS）
      const data = await fetchJson('/api/backends/chat-completions/status', {
        method: 'POST',
        headers: getContextHeaders(),
        body: JSON.stringify({
          chat_completion_source: 'openai',
          reverse_proxy: base,
          proxy_password: settings.apiKey || ''
        })
      });
      if (data && data.error) {
        throw new Error('SillyTavern 后端无法获取模型列表，请检查 API URL、密钥或中转是否可用');
      }
      if (data && Array.isArray(data.data)) {
        return data.data.map(m => (typeof m === 'string' ? m : m && m.id)).filter(Boolean);
      }
      throw new Error('无法解析模型列表');
    }

    // 回退：浏览器直连（会受 CORS 限制）
    const url = base + '/models';
    const headers = { 'Content-Type': 'application/json' };
    if (settings.apiKey) headers['Authorization'] = 'Bearer ' + settings.apiKey;

    const data = await fetchJson(url, { headers });
    if (data.data && Array.isArray(data.data)) {
      return data.data.map(m => m.id);
    }
    throw new Error('无法解析模型列表');
  }

  return { callApi, parseJSON, getSettings, fetchModelList };
})();
