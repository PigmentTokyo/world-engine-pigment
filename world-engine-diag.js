// world-engine-diag.js — read-only diagnostic package exporter.
window.WORLD_ENGINE_DIAG = (function() {
  function safe(fn) {
    try {
      const value = fn();
      return value === undefined ? null : value;
    } catch (e) {
      return { error: String(e && e.message || e) };
    }
  }

  function sanitizeSettings(settings) {
    if (!settings || typeof settings !== 'object') return settings;
    const out = {};
    Object.keys(settings).forEach(function(key) {
      const value = settings[key];
      if (key === 'apiKey') {
        out[key] = value ? ('*** set (len=' + String(value).length + ')') : '(empty)';
      } else if (key === 'apiUrl') {
        out[key] = value ? '(set)' : '(empty)';
      } else {
        out[key] = value;
      }
    });
    return out;
  }

  function countArray(value) {
    return Array.isArray(value) ? value.length : 0;
  }

  function getContext() {
    try {
      return window.SillyTavern && typeof window.SillyTavern.getContext === 'function'
        ? window.SillyTavern.getContext()
        : null;
    } catch (e) {
      return null;
    }
  }

  function countChat(chat) {
    let user = 0;
    let ai = 0;
    (Array.isArray(chat) ? chat : []).forEach(function(message) {
      if (!message) return;
      if (message.is_user) user += 1;
      else ai += 1;
    });
    return { total: Array.isArray(chat) ? chat.length : 0, user: user, ai: ai };
  }

  function collect() {
    const core = window.WORLD_ENGINE_CORE;
    const api = window.WORLD_ENGINE_API;
    const store = window.WORLD_ENGINE_STORE;
    const evo = window.WORLD_ENGINE_EVOLUTION;
    const worldbook = window.WORLD_ENGINE_WORLDBOOK;
    const rules = window.WORLD_ENGINE_RULES;
    const presets = window.WORLD_ENGINE_PRESETS;

    const diag = {};

    diag.meta = safe(function() {
      return {
        extVersion: window.WORLD_ENGINE_VERSION || null,
        collectedAt: new Date().toISOString(),
        userAgent: (typeof navigator !== 'undefined' && navigator.userAgent) || null
      };
    });

    diag.env = safe(function() {
      const ctx = getContext();
      const chat = (ctx && ctx.chat) || [];
      return {
        chatId: (ctx && (ctx.chatId || ctx.chat_id || ctx.chat)) || null,
        chat: countChat(chat),
        name1: (ctx && ctx.name1) || null,
        name2: (ctx && ctx.name2) || null,
        characterId: ctx && ctx.characterId != null ? ctx.characterId : null,
        hasChatMetadata: !!(ctx && (ctx.chatMetadata || ctx.chat_metadata || ctx.metadata)),
        tavernApi: {
          updateChatMetadata: !!(ctx && typeof ctx.updateChatMetadata === 'function'),
          saveMetadataDebounced: !!(ctx && typeof ctx.saveMetadataDebounced === 'function'),
          saveMetadata: !!(ctx && typeof ctx.saveMetadata === 'function'),
          saveChat: !!(ctx && typeof ctx.saveChat === 'function')
        }
      };
    });

    diag.settings = safe(function() {
      if (!api || typeof api.getSettings !== 'function') return { error: 'WORLD_ENGINE_API.getSettings unavailable' };
      return sanitizeSettings(api.getSettings(true));
    });

    diag.activePreset = safe(function() {
      if (!presets || typeof presets.getActivePreset !== 'function') return { error: 'WORLD_ENGINE_PRESETS unavailable' };
      const preset = presets.getActivePreset() || {};
      return {
        id: preset.id || null,
        name: preset.name || null,
        mode: preset.mode || 'classic',
        builtin: !!preset.builtin,
        disabledModules: Array.isArray(preset.disabledModules) ? preset.disabledModules.slice() : [],
        moduleCount: Array.isArray(preset.modules) ? preset.modules.length : 0,
        moduleIds: Array.isArray(preset.modules) ? preset.modules.map(function(module) { return module && module.id; }).filter(Boolean) : []
      };
    });

    diag.rules = safe(function() {
      if (!rules) return { error: 'WORLD_ENGINE_RULES unavailable' };
      const descriptors = typeof rules.getActiveModuleDescriptors === 'function' ? rules.getActiveModuleDescriptors() : [];
      const warnings = typeof rules.getActiveModuleDescriptorWarnings === 'function' ? rules.getActiveModuleDescriptorWarnings() : [];
      return {
        ruleCount: typeof rules.getRuleCount === 'function' ? rules.getRuleCount() : null,
        activeModules: descriptors.map(function(descriptor) {
          return {
            id: descriptor.id,
            field: descriptor.field,
            kind: descriptor.kind,
            name: descriptor.name || descriptor.id,
            enabled: descriptor.enabled !== false,
            container: descriptor.container || null
          };
        }),
        warnings: warnings
      };
    });

    diag.worldState = safe(function() {
      if (!core || typeof core.loadState !== 'function') return { error: 'WORLD_ENGINE_CORE.loadState unavailable' };
      const state = core.loadState() || {};
      const customState = state.custom || state.customModules || {};
      return {
        round: state.round,
        chatLayer: state.chatLayer,
        worldDigestLen: String(state.worldDigest || '').length,
        time: state.time,
        counts: {
          events: countArray(state.events),
          factions: countArray(state.factions),
          winds: countArray(state.winds),
          worldTrends: countArray(state.worldTrends),
          memories: countArray(state.memories),
          enemies: countArray(state.enemies),
          influenceChain: countArray(state.influenceChain),
          economySignals: countArray(state.economy && state.economy.signals),
          secretActions: countArray(state.blackbox && state.blackbox.secretActions),
          secretAssets: countArray(state.blackbox && state.blackbox.secretAssets),
          customKeys: customState && typeof customState === 'object' ? Object.keys(customState).length : 0
        },
        regionalIncidentActive: !!(state.regionalIncident && state.regionalIncident.active),
        hasLastInjection: !!state.lastInjection,
        hasLastEvolveResult: !!state.lastEvolveResult,
        hasState: typeof core.hasState === 'function' ? core.hasState() : null
      };
    });

    diag.checkpoint = safe(function() {
      if (!core || typeof core.restoreCheckpoint !== 'function') return { error: 'WORLD_ENGINE_CORE.restoreCheckpoint unavailable' };
      const checkpoint = core.restoreCheckpoint();
      if (!checkpoint) return { exists: false };
      return { exists: true, round: checkpoint.round, chatLayer: checkpoint.chatLayer, time: checkpoint.time };
    });

    diag.fingerprint = safe(function() {
      if (!core) return { error: 'WORLD_ENGINE_CORE unavailable' };
      return {
        fingerprint: typeof core.loadFingerprint === 'function' ? core.loadFingerprint() : null,
        chatLayer: typeof core.getChatLayer === 'function' ? core.getChatLayer() : null,
        isNewRound: typeof core.isNewRound === 'function' ? core.isNewRound() : null,
        lastStoryDay: typeof core.getLastStoryDay === 'function' ? core.getLastStoryDay() : null,
        anchorLayer: typeof core.getAnchorLayer === 'function' ? core.getAnchorLayer() : null
      };
    });

    diag.evolution = safe(function() {
      if (!evo) return { error: 'WORLD_ENGINE_EVOLUTION unavailable' };
      const debug = typeof evo.getLastDebug === 'function' ? evo.getLastDebug() : {};
      return {
        isRunning: typeof evo.isRunning === 'function' ? evo.isRunning() : null,
        lastError: typeof evo.getLastError === 'function' ? evo.getLastError() : null,
        lastPromptLen: String((debug && debug.prompt) || '').length,
        lastRawResultLen: String((debug && debug.rawResult) || '').length,
        promptSegmentCount: Array.isArray(debug && debug.segments) ? debug.segments.length : 0,
        lastPromptPreview: String((debug && debug.prompt) || '').slice(0, 1000),
        lastRawResultPreview: String((debug && debug.rawResult) || '').slice(0, 1000)
      };
    });

    diag.worldbook = safe(function() {
      if (!worldbook) return { error: 'WORLD_ENGINE_WORLDBOOK unavailable' };
      const ids = typeof worldbook.getSelectedIds === 'function' ? worldbook.getSelectedIds() : [];
      const overrides = typeof worldbook.getOverrides === 'function' ? worldbook.getOverrides() : {};
      return {
        selectedCount: Array.isArray(ids) ? ids.length : 0,
        selectedIds: Array.isArray(ids) ? ids : [],
        hasSelection: typeof worldbook.hasSelection === 'function' ? worldbook.hasSelection() : null,
        triggerEnabled: typeof worldbook.triggerEnabled === 'function' ? worldbook.triggerEnabled() : null,
        overrides: overrides || {}
      };
    });

    diag.filterRegex = safe(function() {
      if (!core || typeof core.validateFilterRegex !== 'function') return { error: 'WORLD_ENGINE_CORE.validateFilterRegex unavailable' };
      const settings = api && typeof api.getSettings === 'function' ? api.getSettings(true) : {};
      const raw = settings && settings.evolveFilterRegex ? String(settings.evolveFilterRegex) : '';
      const result = core.validateFilterRegex(raw);
      return {
        rawTextLength: raw.length,
        rawLineCount: raw ? raw.split('\n').length : 0,
        nonEmptyCount: result.ok + result.bad.length,
        validCount: result.ok,
        invalidCount: result.bad.length,
        invalidList: result.bad,
        validList: result.entries.map(function(entry) { return { line: entry.line, flags: entry.flags }; }),
        rawPreview: raw.slice(0, 200)
      };
    });

    diag.store = safe(function() {
      if (!store || typeof store.keys !== 'function') return { error: 'WORLD_ENGINE_STORE.keys unavailable' };
      const keys = store.keys();
      return { count: keys.length, keys: keys };
    });

    return diag;
  }

  function download() {
    const diag = collect();
    const content = JSON.stringify(diag, null, 2);
    let chatId = 'unknown';
    try {
      const ctx = getContext();
      chatId = String((ctx && (ctx.chatId || ctx.chat_id || ctx.chat)) || 'unknown').replace(/[^\w.-]+/g, '_').slice(0, 40);
    } catch (e) {}
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'world-engine-diag-' + chatId + '-' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(url);
    return content;
  }

  return { collect: collect, download: download };
})();