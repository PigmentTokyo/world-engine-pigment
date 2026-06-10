// world-engine-api.js — 独立 API 调用（支持自定义 OpenAI 兼容 API）
window.WORLD_ENGINE_API = (function() {
  let cachedSettings = null;

  function getSettings(forceRefresh) {
    if (forceRefresh) cachedSettings = null;
    if (cachedSettings) return cachedSettings;
    const raw = localStorage.getItem('world_engine_settings');
    if (raw) {
      try { cachedSettings = JSON.parse(raw); return cachedSettings; } catch(e) {}
    }
    cachedSettings = {
      apiUrl: '',
      apiKey: '',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 2000
    };
    return cachedSettings;
  }

  function normalizeUrl(url) {
    let u = url.trim().replace(/\/+$/, '');
    if (!u) return '';
    if (u.endsWith('/chat/completions')) return u;
    if (u.endsWith('/v1')) return u + '/chat/completions';
    return u + '/v1/chat/completions';
  }

  /**
   * 调用独立 API（非酒馆自带），OpenAI 兼容格式
   */
  async function callApi(prompt, maxTokens, temperature, signal) {
    const settings = getSettings();
    const url = normalizeUrl(settings.apiUrl);
    if (!url) throw new Error('❌ 未配置 API URL，请在设置中填写');

    const body = {
      model: settings.model || 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: temperature ?? settings.temperature ?? 0.7,
      max_tokens: maxTokens ?? settings.maxTokens ?? 2000
    };

    const headers = {
      'Content-Type': 'application/json'
    };
    if (settings.apiKey) {
      headers['Authorization'] = 'Bearer ' + settings.apiKey;
    }

    console.log('[世界引擎] 调用 API:', url, body.model);

    const resp = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
      signal: signal || null
    });

    if (!resp.ok) {
      let detail = '';
      try { const err = await resp.json(); detail = err.error?.message || JSON.stringify(err); } catch(e) {}
      throw new Error(`HTTP ${resp.status}: ${detail}`);
    }

    const data = await resp.json();
    return data.choices[0].message.content;
  }

  /**
   * 解析 API 返回的 JSON（容错处理）
   */
  function parseJSON(text) {
    let content = text.trim();
    content = content.replace(/^```json\s*/i, '').replace(/\s*```\s*$/, '').trim();
    try {
      return JSON.parse(content);
    } catch(e) {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        try { return JSON.parse(match[0]); } catch(e2) {}
      }
    }
    return null;
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

    const resp = await fetch(url, { headers });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (data.data && Array.isArray(data.data)) {
      return data.data.map(m => m.id);
    }
    throw new Error('无法解析模型列表');
  }

  return { callApi, parseJSON, getSettings, fetchModelList };
})();
