# 世界引擎 · 自由模式改造 — 交接说明（给接手的 AI / 开发者）

> 读完本文 + 第 3 节列出的文件，并跑通第 5 节的闸门，即可无缝接手。

## 1. 一句话现状
正在给 SillyTavern「世界引擎」插件做**自由模式**改造：在写死的 12 个模块之外，支持「按世界观自定义模块」。
**Phase 0（设计+基线）与 Phase 1（描述符抽象层）已完成且 classic 零回归**；下一步是 Phase 2（把机制做成通用引擎）。

## 2. 目标与架构决策（已和用户确认，不要推翻）
- 目标：classic（现有 12 模块）之外增加 **free 模式**，可自定义模块；并允许 **混合**（free 里掺入内置模块、复用其机制）。
- 通用模块**保留可配置机制**：骰子 / 阶段机 / 裁决 都做成 config 驱动，不是只能当“字段笔记”。
- 架构：**一个引擎 + `preset.mode` 开关 + 模块描述符抽象**。**不做两份平行引擎。**
- 🔴 头号红线：**classic 模式任何改动都不得行为回归**（注入 prompt、state 演化、UI 渲染都要逐字一致）。

## 3. 必读文件（按顺序）
1. `自由模式改造清单.md` — 主线路线图（8 阶段 + 6.1/6.2），勾选状态实时反映进度。**这是事实来源。**
2. `docs/模块描述符规格.md` — ModuleDescriptor 数据契约（id/name/container/fields/rules/display/mechanics）。
3. `docs/内置模块盘点表.md` — 12 个内置模块在引擎里用了哪些“特权机制”的事实清单（Phase 2 的需求来源）。
4. 本文件 `docs/HANDOFF.md`。

## 4. 已完成（Phase 0–1）
**Phase 0**：写了描述符规格、机制/渲染盘点表；捕获了 classic 静态基线并建了自动闸门。
**Phase 1**：建立了三层「分发」抽象，全部锁到描述符层、classic 零回归：
- `world-engine-rules-loader.js`：`getModuleDescriptors()` / `getActiveModuleDescriptors()` 描述符层 + `BUILTIN_MECHANICS` 机制元数据。规则注入(`getAllRulesText`)、字段映射(`getDisabledOutputFields`)、模块列表(`getModuleList`)均改为从描述符派生。
- `world-engine-evolution.js`：10 个输出模块的合并逻辑抽成处理器，登记进 **`BUILTIN_MERGE`** 分发表。`evolve()` 仍按固定顺序调用以保 classic；分发表备给 free 查表。
- `world-engine-ui.js`：建 **`BUILTIN_RENDER`** 渲染分发表 + `renderModuleSection()`，`renderHomeViewExpanded`/`renderSubView`/`renderCheckpointSections` 改为查表分发。另含一个 `__test` 钩子（暴露内部渲染函数供快照测试）。

三张分发表（MECHANICS/MERGE/RENDER）都覆盖**相同的 10 个输出模块**（另有 `world`/`contact` 两个纯规则模块，container='none'）。

## 5. 回归闸门 —— 动手前必读，改完必跑
所有闸门在 `node` 下运行，无需浏览器。**任何会改变行为的改动，改完都必须四道全绿。**
```
node tests/phase1-descriptors.test.js   # 描述符层正确性（24 断言）
node tests/baseline-diff.js             # 静态：注入 prompt/输出契约/schema 逐字比对 5 个内置预设
node tests/evolve-harness.js            # 动态：种子化随机+冻结时间+mock LLM，跑 3 轮比对 state 演化
node tests/ui-render-harness.js         # UI：17 个渲染快照逐字比对
```
基线文件在 `tests/baselines/`。
- 闸门**红了**：要么你改回归了（修），要么是**预期内**的行为变更（极少；确认后用 `--update` 重置对应基线，evolve/ui harness 支持该参数）。
- `tests/baselines/classic-baseline-pre-refactor.json` 原始版本是用户在真实 SillyTavern 里导出的“自由模式改造前”静态基线（黄金真相），自由模式改造期间**不允许重新生成**。改造收尾后它的角色转为「已批准的 classic 契约」：仅当**有意变更 prompt 契约**（如移植上游 v2.4.0 稳定实体 ID）时才允许更新，且必须先逐行核对新旧差异全部属于本次有意变更（参考 2026-07-11 稳定 ID 移植的做法：脚本比对 + 白名单核对后重写），核对记录写进提交说明。

## 6. 工作纪律
1. 先读路线图，认领下一个未勾选项。
2. **改行为前先确保有闸门覆盖**；没有就先建（参考 evolve/ui harness 的写法：stub 环境 + 加载真实模块 + 固定输入 + 快照比对）。
3. 小步改 → 跑闸门 → 绿 → 再下一步。每个阶段建议独立分支/独立提交，便于回退。
4. 改完更新 `自由模式改造清单.md` 的勾选与注记。
5. 固定枚举（声誉5档/势力6态/关系7级/经济4况/稳定5档）是 classic 灵魂，通用裁决引擎要**兼容**而非替换。

## 7. 下一步：Phase 2（通用机制引擎，config 驱动）
把 evolution 里写死的机制抽成可配置的纯函数引擎，并让内置模块改用它们（关键：必须零回归，靠 evolve-harness 守）：
- `DiceEngine`：覆盖三家族——阈值推进骰(events)、触发骰(regional，含冷却/持续/加权)、消散骰(winds)。
- `StageMachine`：多 type 阶段序列 + 阶段内进度(events)。
- `VerdictEngine`：多轴×固定档位×可换描述（reputation/factions/economy）。
- `Lifecycle`：上限/过期/终局保留（influence/enemies/events/trends/economy.signals/blackbox）。
盘点表(`docs/内置模块盘点表.md` 第二节)是这些引擎的精确需求来源，含常量出处（`EVENT_STAGE_BASE`/`WIND_DECAY`/`getRegionalConfig` 等）。
建议：先抽 `DiceEngine` 把 regional 改成它的一个配置实例 → 跑 evolve-harness 零差异 → 再逐个。

## 8. 注意事项 / 已知坑
- `evolve()` 里有些随机用了裸 `Math.random()`（如 `forceTriggerEvents`），未参数化；evolve-harness 用**全局覆盖 `Math.random`+冻结 `Date.now`** 取得确定性，无需改源码即可比对。Phase 2 若把 randomFn 参数化，记得保持默认 `Math.random` 以不回归。
- `state.lastUpdated.timestamp = Date.now()` 是 evolve 里唯一的时间非确定源（harness 已冻结）。
- UI 渲染快照依赖 `renderPagedList` 的自增计数器，harness 每次快照前调 `__test.resetPager()` 保证确定。
- `world`、`contact` 是纯规则模块（container='none'，无输出字段、无面板），描述符/分发表需容忍这一形态。

## 9. 关键代码地标
- 描述符层：`world-engine-rules-loader.js` 搜 `getModuleDescriptors` / `BUILTIN_MECHANICS` / `OUTPUT_SCHEMAS` / `RULES`。
- 合并分发：`world-engine-evolution.js` 搜 `BUILTIN_MERGE` / `mergeEvents` / `EVENT_STAGE_ORDER` / `rollRegionalIncident` / `decayWinds`。
- 渲染分发：`world-engine-ui.js` 搜 `BUILTIN_RENDER` / `renderModuleSection` / `__test`。
- 预设/术语/生成：`world-engine-presets.js` 搜 `normalizePreset` / `generateFromWorldbook` / `uiModuleLabel` / `INTERNAL_SCHEMA`。
- 用户后续需求已记进路线图 6.1/6.2（生成时按世界观裁剪内置模块、模块数量策略、生成选项二级菜单）。
