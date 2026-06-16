// world-engine-api.js — 独立 API 调用（支持自定义 OpenAI 兼容 API）
window.WORLD_ENGINE_API = (function() {
  let cachedSettings = null;

  function getSettings(forceRefresh) {
    if (forceRefresh) cachedSettings = null;
    if (cachedSettings) return cachedSettings;
    const defaults = {
      apiUrl: '',
      apiKey: '',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 2000,
      injectIntoPrompt: true,
      evolveMode: 'auto',
      evolveEveryX: 1,
      evolveReadRounds: 1,
      evolveFilterRegex: '',
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
    if (raw) {
      try { cachedSettings = { ...defaults, ...JSON.parse(raw) }; return cachedSettings; } catch(e) {}
    }
    cachedSettings = defaults;
    return cachedSettings;
  }

  function normalizeUrl(url) {
    let u = url.trim().replace(/\/+$/, '');
    if (!u) return '';
    if (u.endsWith('/chat/completions')) return u;
    if (u.endsWith('/v1')) return u + '/chat/completions';
    return u + '/v1/chat/completions';
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
    const settings = getSettings();
    const url = normalizeUrl(settings.apiUrl);
    if (!url) throw new Error('未配置 API URL，请在设置中填写');

    const resolvedMaxTokens = Number(maxTokens ?? settings.maxTokens ?? 2000);
    const resolvedTemperature = Number(temperature ?? settings.temperature ?? 0.7);
    const body = {
      model: settings.model || 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: Number.isFinite(resolvedTemperature) ? resolvedTemperature : 0.7,
      max_tokens: Number.isFinite(resolvedMaxTokens) ? resolvedMaxTokens : 2000
    };

    const headers = {
      'Content-Type': 'application/json'
    };
    if (settings.apiKey) {
      headers['Authorization'] = 'Bearer ' + settings.apiKey;
    }

    console.log('[世界引擎] 调用 API:', url, body.model);

    const data = await fetchJson(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
      signal: signal || null
    });
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
    const baseUrl = normalizeUrl(settings.apiUrl).replace(/\/chat\/completions$/, '');
    const url = baseUrl + '/models';
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
