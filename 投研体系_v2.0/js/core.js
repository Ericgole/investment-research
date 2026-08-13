/**
 * 投研体系 v2.0 — 核心JavaScript类
 * DataPipelineRunner / AlertEngine / TAADeviationWorkflow / ReportEngine
 * Generated: 2026-08-10
 */
(function() {
'use strict';

// ============================================================
// 1. DataPipelineRunner — ETL数据管道调度器
// ============================================================
class DataPipelineRunner {
  constructor(config) {
    this.config = Object.assign({
      stages: ['collect', 'validate', 'etl', 'compute', 'deploy'],
      timeoutMs: 120000,
      retryCount: 2,
      rollbackOnFailure: true
    }, config);
    this.runId = null;
    this.stageResults = {};
    this.listeners = [];
  }

  /** 获取管道状态配置 */
  static STAGES = {
    collect:  { name: '数据采集',  icon: '\u{1F4E1}', expectMs: 18000, validator: 'nonEmptyCheck' },
    validate: { name: '数据校验',  icon: '\u{1F50D}', expectMs: 12000, validator: 'rangeConsistencyCheck' },
    etl:      { name: 'ETL转换',   icon: '\u{2699}\u{FE0F}', expectMs: 8000,  validator: 'formatMappingCheck' },
    compute:  { name: '指标计算',  icon: '\u{1F4CA}', expectMs: 22000, validator: 'indicatorCompletenessCheck' },
    deploy:   { name: '看板部署',  icon: '\u{1F680}', expectMs: 4000,  validator: 'deployReachabilityCheck' }
  };

  /** 运行完整管道 */
  async run() {
    this.runId = 'ETL-' + Date.now();
    var startTime = Date.now();
    this._notify('start', { runId: this.runId, time: new Date().toISOString() });

    for (var i = 0; i < this.config.stages.length; i++) {
      var stage = this.config.stages[i];
      var stageStart = Date.now();
      
      try {
        // 模拟阶段执行
        var result = await this._executeStage(stage, i);
        var duration = Date.now() - stageStart;
        
        // 校验
        var validation = this._validateStage(stage, result);
        
        this.stageResults[stage] = {
          status: validation.passed ? 'success' : 'partial_failure',
          durationMs: duration,
          recordsProcessed: result.count || 0,
          recordsFailed: validation.failedCount || 0,
          errorMessage: validation.errors.join('; ') || null,
          rollbackTo: null
        };

        // 失败处理
        if (!validation.passed && this.config.rollbackOnFailure) {
          var rollbackStage = this._findRollbackStage(i);
          this.stageResults[stage].rollbackTo = rollbackStage;
          this.stageResults[stage].status = 'rollback';
        }

        this._notify('stage_complete', { stage: stage, result: this.stageResults[stage] });
      } catch(e) {
        this.stageResults[stage] = { status: 'failed', errorMessage: e.message, durationMs: Date.now() - stageStart };
        this._notify('stage_error', { stage: stage, error: e.message });
        break;
      }
    }

    var totalDuration = Date.now() - startTime;
    this._notify('complete', { runId: this.runId, totalDurationMs: totalDuration, results: this.stageResults });
    return { runId: this.runId, totalDurationMs: totalDuration, results: this.stageResults };
  }

  /** 模拟阶段执行 */
  async _executeStage(stage, index) {
    var info = DataPipelineRunner.STAGES[stage];
    var ms = info.expectMs * (0.7 + Math.random() * 0.6); // 模拟耗时波动
    await this._sleep(Math.min(ms, 200)); // 演示版缩短等待
    
    // 模拟成功率：除compute外都接近100%
    var failRate = stage === 'compute' ? 0.08 : stage === 'validate' ? 0.0 : 0.0;
    var total = stage === 'compute' ? 24 : stage === 'collect' ? 6 : 10;
    var failed = Math.floor(total * failRate);
    
    return { count: total - failed, failed: failed, raw: {} };
  }

  /** 校验阶段结果 */
  _validateStage(stage, result) {
    var errors = [];
    if (result.failed > 0) {
      errors.push(stage + ' 阶段: ' + result.failed + '项失败');
    }
    return { passed: errors.length === 0, errors: errors, failedCount: result.failed };
  }

  /** 找到回退目标阶段 */
  _findRollbackStage(currentIndex) {
    return currentIndex > 0 ? this.config.stages[currentIndex - 1] : null;
  }

  /** 事件监听 */
  on(event, callback) { this.listeners.push({ event: event, callback: callback }); }
  _notify(event, data) {
    for (var i = 0; i < this.listeners.length; i++) {
      if (this.listeners[i].event === event || this.listeners[i].event === '*') {
        this.listeners[i].callback(data);
      }
    }
  }
  _sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }
}

// ============================================================
// 2. AlertEngine — 主动预警引擎
// ============================================================
class AlertEngine {
  constructor(config) {
    this.config = Object.assign({
      rules: [],
      checkIntervalMs: 5000,       // 5秒检查间隔
      pushChannel: 'dashboard',     // feishu/dashboard/both
      cooldownMinutes: 60
    }, config);
    this.rules = [];
    this.history = [];
    this.timer = null;
    this.listeners = [];
  }

  /** 预警规则模板（10条） */
  static DEFAULT_RULES = [
    { id: 1, name: '信用利差异常',      category: 'data',   trigger: function(v) { return v.status === 'expired' || (v.spread && v.spread > 50); }, severity: 'severe', channel: 'both' },
    { id: 2, name: 'TAA调整线突破',      category: 'market', trigger: function(v) { return Math.abs(v.score) > 0.75; },                    severity: 'warning', channel: 'both' },
    { id: 3, name: '权益仓位告警',      category: 'market', trigger: function(v) { return v.equityRatio > 56; },                           severity: 'warning', channel: 'feishu' },
    { id: 4, name: 'PE分位偏高',        category: 'market', trigger: function(v) { return v.pePercentile > 85; },                          severity: 'info',    channel: 'dashboard' },
    { id: 5, name: '组合回撤预警',      category: 'market', trigger: function(v) { return v.drawdown > 5; },                               severity: 'warning', channel: 'feishu' },
    { id: 6, name: 'VaR超限',          category: 'market', trigger: function(v) { return Math.abs(v.var) > 8; },                           severity: 'severe',  channel: 'both' },
    { id: 7, name: 'QDII汇率敞口',     category: 'market', trigger: function(v) { return v.fxExposure > 20 && v.cnyAppreciation > 2; },    severity: 'warning', channel: 'dashboard' },
    { id: 8, name: '黄金超涨预警',      category: 'market', trigger: function(v) { return v.gold30dReturn > 15; },                         severity: 'warning', channel: 'feishu' },
    { id: 9, name: '标普500回撤',      category: 'market', trigger: function(v) { return v.sp500Drawdown > 10; },                          severity: 'warning', channel: 'feishu' },
    { id: 10,name: 'M2-M1剪刀差',     category: 'market', trigger: function(v) { return v.m2m1Spread < -3.5; },                           severity: 'info',    channel: 'dashboard' }
  ];

  /** 加载规则 */
  loadRules(rules) {
    this.rules = rules || AlertEngine.DEFAULT_RULES;
    // 初始化状态
    for (var i = 0; i < this.rules.length; i++) {
      this.rules[i].status = 'active';
      this.rules[i].lastTriggered = null;
    }
  }

  /** 检查所有规则 */
  checkAll(snapshot) {
    var triggered = [];
    var now = new Date();

    for (var i = 0; i < this.rules.length; i++) {
      var rule = this.rules[i];
      var value = this._extractValue(snapshot, rule);
      var shouldTrigger = rule.trigger(value);
      
      if (shouldTrigger) {
        // 冷却检查
        if (rule.lastTriggered && (now - rule.lastTriggered) < this.config.cooldownMinutes * 60000) {
          continue;
        }
        rule.status = 'triggered';
        rule.lastTriggered = now;
        rule.currentValue = JSON.stringify(value);
        
        var alert = {
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          message: this._formatMessage(rule, value),
          triggerTime: now,
          channel: rule.channel
        };
        triggered.push(alert);
        this.history.push(alert);
        
        this._notify('alert_triggered', alert);
        
        // 推送通知
        if (rule.channel === 'feishu' || rule.channel === 'both') {
          this._pushFeishu(alert);
        }
        if (rule.channel === 'dashboard' || rule.channel === 'both') {
          this._pushDashboard(alert);
        }
      } else if (rule.status !== 'triggered') {
        // 检查是否应处于监控状态
        rule.status = this._isMonitoring(rule, value) ? 'monitoring' : 'active';
      }
    }

    this._notify('check_complete', { total: this.rules.length, triggered: triggered.length, alerts: triggered });
    return triggered;
  }

  /** 提取指标值 */
  _extractValue(snapshot, rule) {
    var map = {
      1:  { status: snapshot.dataStatus, spread: snapshot.creditSpread },
      2:  { score: snapshot.taaScore },
      3:  { equityRatio: snapshot.equityRatio },
      4:  { pePercentile: snapshot.pePercentile },
      5:  { drawdown: snapshot.drawdown },
      6:  { var: snapshot.var },
      7:  { fxExposure: snapshot.fxExposure, cnyAppreciation: snapshot.cnyAppreciation },
      8:  { gold30dReturn: snapshot.gold30dReturn },
      9:  { sp500Drawdown: snapshot.sp500Drawdown },
      10: { m2m1Spread: snapshot.m2m1Spread }
    };
    return map[rule.id] || snapshot;
  }

  _isMonitoring(rule, value) {
    // 简单判断：指标接近触发线时进入监控
    var monitors = { 4: 80, 7: 18, 10: -3.0 };
    var threshold = monitors[rule.id];
    if (threshold === undefined) return false;
    var v = Object.values(value)[0];
    return rule.id === 10 ? (v < threshold) : (v > threshold);
  }

  _formatMessage(rule, value) {
    var msgs = {
      1: '信用利差数据断流超7天或利差异常',
      2: 'TAA加权分 ' + (value.score > 0 ? '+' : '') + value.score + ' 突破±0.75调整线',
      3: '权益仓位 ' + value.equityRatio + '% 接近60%上限',
      4: '沪深300 PE 5Y分位 ' + value.pePercentile + '%',
      5: '组合5日回撤 ' + value.drawdown + '%',
      6: 'VaR(99%,10日) ' + value.var + '% 超限',
      7: 'QDII敞口 ' + value.fxExposure + '% + CNY升值',
      8: '黄金30日涨幅 ' + value.gold30dReturn + '%',
      9: '标普500 10日回撤 ' + value.sp500Drawdown + '%',
      10: 'M2-M1剪刀差 ' + value.m2m1Spread + 'pp'
    };
    return msgs[rule.id] || '规则触发';
  }

  /** 飞书推送（模拟） */
  _pushFeishu(alert) {
    var payload = {
      msg_type: 'interactive',
      card: {
        header: { title: { content: '\u{1F514} 投研预警: ' + alert.ruleName, tag: 'plain_text' } },
        elements: [
          { tag: 'div', text: { content: '**' + alert.message + '**', tag: 'lark_md' } },
          { tag: 'div', text: { content: '触发时间: ' + alert.triggerTime.toISOString() + ' | 严重度: ' + alert.severity, tag: 'lark_md' } }
        ]
      }
    };
    console.log('[AlertEngine] 飞书推送:', alert.ruleName, payload);
    this._notify('feishu_push', { alert: alert, payload: payload });
    return { status: 'sent', channel: 'feishu', time: new Date().toISOString() };
  }

  _pushDashboard(alert) {
    this._notify('dashboard_notify', alert);
  }

  /** 启动定时检查 */
  start(snapshotProvider) {
    var self = this;
    this.stop();
    this.timer = setInterval(function() {
      if (snapshotProvider) {
        self.checkAll(snapshotProvider());
      }
    }, this.config.checkIntervalMs);
  }

  stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }

  /** 事件 */
  on(event, cb) { this.listeners.push({ event: event, callback: cb }); }
  _notify(event, data) {
    for (var i = 0; i < this.listeners.length; i++) {
      if (this.listeners[i].event === event) this.listeners[i].callback(data);
    }
  }
}

// ============================================================
// 3. TAADeviationWorkflow — TAA偏离7步审批工作流
// ============================================================
class TAADeviationWorkflow {
  constructor() {
    this.steps = [
      { id: 1, name: '触发识别',   role: 'system',  autoCheck: true,  desc: 'TAA评分突破±0.75,自动记录触发原因' },
      { id: 2, name: '自动预检',   role: 'system',  autoCheck: true,  desc: '计算偏离影响:偿付能力/VaR/覆盖率变化' },
      { id: 3, name: '方案生成',   role: 'system',  autoCheck: true,  desc: '生成2-3套偏离方案,含预期收益和风险评估' },
      { id: 4, name: '内部讨论',   role: 'analyst', autoCheck: false, desc: '投研团队讨论,补充分析和约束条件' },
      { id: 5, name: '合规审查',   role: 'compliance', autoCheck: false, desc: '合规部审查:限额/IFRS17/监管要求' },
      { id: 6, name: '投资总监审批', role: 'director', autoCheck: false, desc: 'CIO审批最终方案,设定执行窗口' },
      { id: 7, name: '执行+复盘',  role: 'trader',   autoCheck: false, desc: '交易执行,15天后自动复盘偏离效果' }
    ];
    this.currentStep = 1;
    this.deviationPlan = null;
    this.precheckResult = null;
    this.listeners = [];
    this.status = 'active'; // active/done/cancelled
  }

  /** 运行自动步骤 (1-3) */
  runAutoCheck(taaScore, snapshot) {
    // Step 1: 触发识别
    this.currentStep = 1;
    var triggerReasons = [];
    if (taaScore > 0.75) triggerReasons.push('TAA +' + taaScore + ' 突破+0.75调整线,超配信号');
    if (taaScore < -0.75) triggerReasons.push('TAA ' + taaScore + ' 突破-0.75调整线,低配信号');
    this._notify('step_complete', { step: 1, data: { reasons: triggerReasons } });

    // Step 2: 自动预检
    this.currentStep = 2;
    this.precheckResult = this._runPrecheck(taaScore, snapshot);
    this._notify('step_complete', { step: 2, data: this.precheckResult });

    // Step 3: 方案生成
    this.currentStep = 3;
    this.deviationPlan = this._generatePlans(taaScore, snapshot);
    this._notify('step_complete', { step: 3, data: this.deviationPlan });

    return { precheck: this.precheckResult, plans: this.deviationPlan };
  }

  /** 预检计算 — 支持动态参数（可通过 snapshot 传入） */
  _runPrecheck(taaScore, snap) {
    snap = snap || {};
    // === Extract baseline from snapshot (allows DA-driven values) ===
    var baseSolvency = snap.solvency || 215;
    var baseReturn = snap.portfolioReturn || 10.2;
    var baseVar = Math.abs(snap.var) || 4.82;
    var baseCoverage = snap.liabilityCoverage || 2.60;
    var baseEquity = snap.equityRatio || 58;
    var equityLimit = snap.equityLimit || 60;

    // === Configurable: deviation parameters ===
    var equityDelta = snap.equityDelta || 3;       // % of equity increase
    var solvencySensitivity = snap.solvencySensitivity || 2.3;  // pp solvency per % equity
    var returnBoost = snap.returnBoost || 0.2;     // % return per % equity
    var varSensitivity = snap.varSensitivity || 0.18; // VaR increase per % equity

    // === Calculate impact ===
    var newSolvency = Math.round(baseSolvency - equityDelta * solvencySensitivity);
    var newReturn = parseFloat((baseReturn + equityDelta * returnBoost).toFixed(1));
    var newVar = parseFloat((baseVar + equityDelta * varSensitivity).toFixed(2));
    var newCoverage = parseFloat((baseCoverage - equityDelta * 0.007).toFixed(2)); // Minor coverage dilution
    var newEquity = baseEquity + equityDelta;

    // === Constraint checks ===
    var constraints = [
      { rule: '偿付能力≥150%', value: newSolvency, limit: 150, status: newSolvency >= 150 ? 'pass' : 'fail', action: newSolvency < 150 ? '无法执行' : null },
      { rule: '权益上限≤' + equityLimit + '%', value: newEquity, limit: equityLimit, status: newEquity <= equityLimit ? 'pass' : 'breach', action: newEquity > equityLimit ? '需调高上限至' + Math.ceil(newEquity * 1.05) + '%' : null },
      { rule: 'VaR≤8%', value: newVar, limit: 8, status: newVar <= 8 ? 'pass' : 'fail', action: newVar > 8 ? '风险超限' : null },
      { rule: '覆盖率≥1.1x', value: newCoverage, limit: 1.1, status: newCoverage >= 1.1 ? 'pass' : 'fail', action: null }
    ];

    return {
      taaScore: taaScore,
      equityDelta: equityDelta,
      proposal: '增配权益+' + equityDelta + '%',
      impact: {
        solvency:     { before: baseSolvency, after: newSolvency, delta: newSolvency - baseSolvency },
        portfolioReturn: { before: baseReturn, after: newReturn, delta: parseFloat((newReturn - baseReturn).toFixed(1)) },
        var99:        { before: baseVar, after: newVar, delta: parseFloat((newVar - baseVar).toFixed(2)) },
        liabilityCoverage: { before: baseCoverage, after: newCoverage, delta: parseFloat((newCoverage - baseCoverage).toFixed(2)) },
        equityRatio:  { before: baseEquity, after: newEquity, delta: newEquity - baseEquity }
      },
      constraintsCheck: constraints,
      timestamp: new Date().toISOString(),
      config: { solvencySensitivity: solvencySensitivity, returnBoost: returnBoost, varSensitivity: varSensitivity }
    };
  }

  /** 生成偏离方案 */
  _generatePlans(taaScore, snap) {
    return {
      recommended: {
        name: '增配创业板+3%',
        detail: '创业板 9%→12%, 资金来源:现金-2%+利率债-1%',
        expectedReturn: 10.8,
        solvencyAfter: 208,
        confidence: 58
      },
      alternative: {
        name: '维持SAA不变',
        detail: '观察1周,等TAA回落或进一步确认',
        expectedReturn: 10.2,
        solvencyAfter: 215,
        confidence: 72
      },
      aggressive: {
        name: '增配权益+5%',
        detail: '创业板+3%+科创50+2%,资金来源:信用债-5%',
        expectedReturn: 11.2,
        solvencyAfter: 198,
        confidence: 35
      }
    };
  }

  /** 推进到下一步 */
  advanceStep(approval) {
    if (this.currentStep >= 7) return false;
    this.currentStep++;
    
    // 模拟审批通过/拒绝
    if (approval) {
      this._notify('step_complete', { step: this.currentStep - 1, approved: true, comment: approval });
    }

    if (this.currentStep === 7) {
      this.status = 'done';
      this._notify('workflow_complete', { status: 'done', decision: this.deviationPlan });
    }
    return true;
  }

  getProgress() {
    return { current: this.currentStep, total: 7, percent: Math.round(this.currentStep / 7 * 100) };
  }

  on(event, cb) { this.listeners.push({ event: event, callback: cb }); }
  _notify(event, data) {
    for (var i = 0; i < this.listeners.length; i++) {
      if (this.listeners[i].event === event) this.listeners[i].callback(data);
    }
  }
}

// ============================================================
// 4. ReportEngine — 自动报告引擎
// ============================================================
class ReportEngine {
  constructor(config) {
    this.config = Object.assign({
      templates: {},
      outputDir: './reports',
      pushChannel: 'feishu+dashboard'
    }, config);
    this.templates = {
      daily: {
        name: '投研日报',
        schedule: '0 30 6 * * *',   // 每天 6:30
        formats: ['html', 'md', 'pdf'],
        version: 'v3.2'
      },
      weekly: {
        name: '风险周报',
        schedule: '0 30 6 * * 1',   // 每周一 6:30
        formats: ['html', 'md'],
        version: 'v2.1'
      },
      monthly: {
        name: '月度复盘',
        schedule: '0 30 6 1 * *',   // 每月1日 6:30
        formats: ['html', 'pdf'],
        version: 'v2.0'
      }
    };
  }

  /** 生成报告 */
  generate(reportType, snapshot) {
    var startTime = Date.now();
    var template = this.templates[reportType];
    if (!template) throw new Error('未知报告类型: ' + reportType);

    var results = {};
    
    // 按格式生成
    for (var f = 0; f < template.formats.length; f++) {
      var format = template.formats[f];
      var content = this._fillTemplate(reportType, format, snapshot);
      results[format] = {
        format: format,
        content: content,
        generatedAt: new Date().toISOString(),
        filePath: './reports/' + reportType + '_' + new Date().toISOString().slice(0,10) + '.' + format
      };
    }

    // 推送
    this._push(results);

    var duration = Date.now() - startTime;
    return {
      reportType: reportType,
      formats: results,
      durationMs: duration,
      status: 'success'
    };
  }

  /** 模板填充 */
  _fillTemplate(type, format, snap) {
    var s = snap || {};
    var lines = [];
    
    lines.push('# 投研体系 ' + this.templates[type].name + ' (' + this.templates[type].version + ')');
    lines.push('> 生成时间: ' + new Date().toLocaleString('zh-CN'));
    lines.push('> 基准参数: TAA=' + (s.taaScore > 0 ? '+' : '') + (s.taaScore || 0.85) + ' | 偿付=' + (s.solvency || 215) + '% | 久期=' + (s.durationGap || -3.2) + '年');
    lines.push('');
    lines.push('## 核心指标');
    lines.push('| 指标 | 当前值 | 状态 |');
    lines.push('|------|--------|------|');
    lines.push('| 偿付能力充足率 | ' + (s.solvency || 215) + '% | ' + ((s.solvency || 215) > 200 ? '\u2705 充裕' : '\u26A0 关注') + ' |');
    lines.push('| TAA加权评分 | ' + (s.taaScore > 0 ? '+' : '') + (s.taaScore || 0.85) + ' | ' + (Math.abs(s.taaScore || 0.85) > 0.75 ? '\u26A0 触发调整线' : '\u2705 正常') + ' |');
    lines.push('| 组合预期收益 | ' + (s.portfolioReturn || 10.2) + '% | 波动 ' + (s.volatility || 7.8) + '% |');
    lines.push('| VaR(99%,10日) | ' + (s.var || 4.82) + '% | \u2705 正常 |');
    lines.push('');
    lines.push('## 预警摘要');
    lines.push('- \u{1F534} 信用利差断流7天 (严重)');
    lines.push('- \u{1F7E1} TAA+0.85触发调整线 (警告)');
    lines.push('- \u{1F7E1} 权益58%接近60%上限 (警告)');
    lines.push('');
    lines.push('## 操作建议');
    lines.push('1. 增配创业板+3% (9%\u219212%)，偿付预降至208%');
    lines.push('2. 调高权益上限至65%');
    lines.push('3. 补拉Wind bond_data信用利差数据');
    lines.push('');
    lines.push('---');
    lines.push('*本报告由投研体系v2.0自动生成，仅供参考，不构成投资建议*');

    return lines.join('\n');
  }

  /** 推送报告（模拟飞书） */
  _push(results) {
    var mdContent = results.md ? results.md.content : null;
    if (mdContent) {
      console.log('[ReportEngine] 飞书推送报告摘要');
      // 模拟webhook调用
    }
  }

  /** 预览报告 (HTML格式) */
  preview(reportType, format) {
    format = format || 'html';
    var content = this._fillTemplate(reportType, format, {});
    return content.replace(/\n/g, '<br>');
  }
}

// ============================================================
// 导出到全局
// ============================================================
window.InvestmentResearch = {
  DataPipelineRunner: DataPipelineRunner,
  AlertEngine: AlertEngine,
  TAADeviationWorkflow: TAADeviationWorkflow,
  ReportEngine: ReportEngine
};

console.log('[投研体系v2.0] 4个核心类已加载: DataPipelineRunner, AlertEngine, TAADeviationWorkflow, ReportEngine');
})();
