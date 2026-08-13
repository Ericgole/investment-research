/**
 * 投研体系 v2.0 — 统一数据访问层
 * data-access.js
 * 封装 SQLite JSON export / localStorage / fetch 三种数据源
 * 
 * 用法:
 *   DA.init().then(function() { var kpi = DA.getKPI(); });
 */
(function() {
'use strict';

var DA = {
  _cache: {},
  _ready: false,
  _basePath: 'data/',

  /** 初始化：从 JSON 文件加载 SQLite 数据快照 */
  init: function(basePath) {
    if (basePath) this._basePath = basePath;
    var self = this;
    var files = ['kpi','saa','taa','alert_rules','risk','data_lineage','report'];
    var promises = [];

    for (var i = 0; i < files.length; i++) {
      promises.push(this._loadJSON(files[i]));
    }

    return Promise.all(promises).then(function() {
      self._ready = true;
      console.log('[DA] 数据层就绪 · ' + files.length + ' 数据集加载完成');
      return self;
    }).catch(function(err) {
      console.warn('[DA] JSON 加载失败，回退到硬编码基线:', err.message);
      self._loadFallbacks();
      self._ready = true;
      return self;
    });
  },

  /** 加载单个 JSON 数据文件 */
  _loadJSON: function(name) {
    var self = this;
    return fetch(this._basePath + name + '.json')
      .then(function(r) {
        if (!r.ok) throw new Error(name + '.json ' + r.status);
        return r.json();
      })
      .then(function(data) {
        self._cache[name] = data;
        return data;
      });
  },

  /** 硬编码回退基线（当 JSON 不可用时） */
  _loadFallbacks: function() {
    this._cache.kpi = { solvency_ratio:215, taa_weighted_score:0.85, equity_ratio:58, duration_gap:-3.2, var_99_10d:-4.82, liability_coverage:2.60 };
    this._cache.saa = [
      {asset_class:'信用债',weight_pct:27,expected_return:2.5,sharpe_ratio:null,liability_coverage:0.71},
      {asset_class:'标普500',weight_pct:23,expected_return:13.0,sharpe_ratio:0.58,liability_coverage:3.71},
      {asset_class:'黄金',weight_pct:21,expected_return:16.7,sharpe_ratio:0.80,liability_coverage:4.77},
      {asset_class:'创业板',weight_pct:9,expected_return:13.0,sharpe_ratio:0.32,liability_coverage:3.71},
      {asset_class:'利率债',weight_pct:9,expected_return:1.9,sharpe_ratio:null,liability_coverage:0.54},
      {asset_class:'沪深300',weight_pct:3,expected_return:4.1,sharpe_ratio:0.05,liability_coverage:1.17},
      {asset_class:'科创50',weight_pct:2,expected_return:14.1,sharpe_ratio:0.33,liability_coverage:4.03},
      {asset_class:'现金',weight_pct:6,expected_return:3.0,sharpe_ratio:null,liability_coverage:0.86}
    ];
    this._cache.taa = [
      {dimension:'宏观',weight:0.25,score:1.0},
      {dimension:'估值',weight:0.25,score:-0.5},
      {dimension:'技术',weight:0.15,score:0.0},
      {dimension:'资金',weight:0.15,score:1.5},
      {dimension:'政策',weight:0.20,score:2.5}
    ];
    this._cache.alert_rules = AlertEngine ? AlertEngine.DEFAULT_RULES : [];
    this._cache.risk = [];
    this._cache.data_lineage = [];
    this._cache.report = [];
  },

  // ===== Getters =====

  /** 获取当前 KPI 快照 */
  getKPI: function() {
    return this._cache.kpi || {};
  },

  /** 获取 SAA 配置 */
  getSAA: function() {
    return this._cache.saa || [];
  },

  /** 获取 TAA 评分 */
  getTAA: function() {
    return this._cache.taa || [];
  },

  /** 获取 TAA 加权总分 */
  getTAAWeighted: function() {
    var scores = this._cache.taa || [];
    var total = 0;
    for (var i = 0; i < scores.length; i++) {
      total += scores[i].score * scores[i].weight;
    }
    return Math.round(total * 100) / 100;
  },

  /** 获取预警规则 */
  getAlertRules: function() {
    return this._cache.alert_rules || [];
  },

  /** 获取风险合规状态 */
  getRiskCompliance: function() {
    return this._cache.risk || [];
  },

  /** 获取数据血缘 */
  getLineage: function() {
    return this._cache.data_lineage || [];
  },

  /** 构建快照对象（供 AlertEngine / ReportEngine 使用） */
  buildSnapshot: function() {
    var kpi = this.getKPI();
    var taa = this.getTAAWeighted();
    return {
      solvency: kpi.solvency_ratio || 215,
      taaScore: taa,
      portfolioReturn: kpi.expected_return || 10.2,
      volatility: kpi.annual_volatility || 7.8,
      durationGap: kpi.duration_gap || -3.2,
      var: kpi.var_99_10d || -4.82,
      equityRatio: kpi.equity_ratio || 58,
      liabilityCoverage: kpi.liability_coverage || 2.60,
      creditSpread: null,
      pePercentile: 87,
      drawdown: 2.1,
      fxExposure: 23,
      cnyAppreciation: 1.5,
      gold30dReturn: 8.3,
      sp500Drawdown: 1.5,
      m2m1Spread: -4.0,
      dataStatus: 'expired'
    };
  },

  // ===== Workflow State Persistence (localStorage) =====
  WF_KEY: 'taa_workflow_state',

  /** 保存工作流状态到 localStorage */
  saveWorkflowState: function(state) {
    try {
      localStorage.setItem(this.WF_KEY, JSON.stringify(state));
      return true;
    } catch(e) { return false; }
  },

  /** 恢复工作流状态 */
  restoreWorkflowState: function() {
    try {
      var raw = localStorage.getItem(this.WF_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  },

  /** 清除工作流状态 */
  clearWorkflowState: function() {
    try { localStorage.removeItem(this.WF_KEY); } catch(e) {}
  },

  // ===== Draft Persistence =====
  DRAFT_KEY: 'taa_workflow_draft',

  saveDraft: function(step, data) {
    try {
      var drafts = JSON.parse(localStorage.getItem(this.DRAFT_KEY) || '{}');
      drafts['step_' + step] = Object.assign({savedAt: new Date().toISOString()}, data);
      localStorage.setItem(this.DRAFT_KEY, JSON.stringify(drafts));
      return true;
    } catch(e) { return false; }
  },

  restoreDraft: function(step) {
    try {
      var drafts = JSON.parse(localStorage.getItem(this.DRAFT_KEY) || '{}');
      return drafts['step_' + step] || null;
    } catch(e) { return null; }
  },

  /** 是否已就绪 */
  isReady: function() { return this._ready; }
};

// Export
window.DA = DA;
console.log('[投研v2.0] data-access.js 已加载');
})();
