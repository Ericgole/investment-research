/**
 * Lineage Tracker - 数据血缘追踪系统
 * 记录每个数据字段的来源→转换→去向链路
 * 提供血缘查询和影响分析
 * @version 1.0.0
 */

const LineageTracker = (function() {
  'use strict';

  // ============ 血缘图谱 ============
  const lineage = {
    // === 偿付能力相关 ===
    'solvency_ratio': {
      source: ['portfolio_assets', 'required_capital'],
      transform: 'calculate_solvency',
      dependents: ['dashboard_kpi', 'risk_alert', 'compliance_report'],
      description: '综合偿付能力充足率',
      category: '偿付能力',
      last_updated: null,
      freshness_hours: 1
    },
    'core_ratio': {
      source: ['core_capital', 'minimum_capital'],
      transform: 'calculate_core_solvency',
      dependents: ['dashboard_kpi', 'solvency_ratio'],
      description: '核心偿付能力充足率',
      category: '偿付能力',
      last_updated: null,
      freshness_hours: 1
    },

    // === 久期/利率相关 ===
    'duration_gap': {
      source: ['asset_duration', 'liability_duration'],
      transform: 'calculate_duration_gap',
      dependents: ['dashboard_kpi', 'risk_alert', 'hedge_strategy'],
      description: '资产负债久期缺口',
      category: '利率风险',
      last_updated: null,
      freshness_hours: 4
    },
    'asset_duration': {
      source: ['bond_holdings', 'yield_curve'],
      transform: 'weighted_duration',
      dependents: ['duration_gap', 'portfolio_risk'],
      description: '资产端加权久期',
      category: '利率风险',
      last_updated: null,
      freshness_hours: 24
    },
    'liability_duration': {
      source: ['policy_cashflows', 'discount_curve'],
      transform: 'liability_duration_model',
      dependents: ['duration_gap', 'alm_report'],
      description: '负债端久期',
      category: '利率风险',
      last_updated: null,
      freshness_hours: 24
    },
    'spread': {
      source: ['portfolio_yield', 'liability_cost'],
      transform: 'calculate_spread',
      dependents: ['dashboard_kpi', 'profit_analysis'],
      description: '投资收益率与负债成本利差',
      category: '利差分析',
      last_updated: null,
      freshness_hours: 24
    },

    // === 组合相关 ===
    'portfolio_total': {
      source: ['all_holdings'],
      transform: 'aggregate_aum',
      dependents: ['saa_allocation', 'dashboard_kpi'],
      description: '组合总规模',
      category: '组合管理',
      last_updated: null,
      freshness_hours: 24
    },
    'asset_allocation': {
      source: ['holdings_by_asset_class'],
      transform: 'calculate_allocation',
      dependents: ['saa_check', 'dashboard_chart'],
      description: '大类资产配置比例',
      category: '组合管理',
      last_updated: null,
      freshness_hours: 24
    },
    'yield_portfolio': {
      source: ['fund_valuations', 'bond_yields', 'equity_returns'],
      transform: 'weighted_yield',
      dependents: ['dashboard_kpi', 'performance_report', 'spread'],
      description: '综合投资收益率',
      category: '收益分析',
      last_updated: null,
      freshness_hours: 24
    },

    // === 基金净值相关 ===
    'nav_data': {
      source: ['fund_valuation_api'],
      transform: 'normalize_nav',
      dependents: ['yield_calc', 'dashboard_fund_table', 'portfolio_valuation'],
      description: '持仓基金净值数据',
      category: '市场数据',
      last_updated: null,
      freshness_hours: 4
    },

    // === 宏观数据 ===
    'macro_data': {
      source: ['央行', '统计局', 'wind_api'],
      transform: 'standardize_macro',
      dependents: ['taa_macro_score', 'asset_forecast', 'risk_model'],
      description: '宏观经济指标',
      category: '宏观研究',
      last_updated: null,
      freshness_hours: 24
    },
    'gdp': {
      source: ['统计局季度数据'],
      transform: 'quarterly_to_annual',
      dependents: ['macro_data', 'growth_forecast'],
      description: 'GDP增长率',
      category: '宏观研究',
      last_updated: null,
      freshness_hours: 2160  // 季度数据
    },
    'cpi': {
      source: ['统计局月度数据'],
      transform: 'ytd_average',
      dependents: ['macro_data', 'inflation_model'],
      description: 'CPI同比',
      category: '宏观研究',
      last_updated: null,
      freshness_hours: 720  // 月度数据
    },
    'rate_10y': {
      source: ['bond_market', 'wind_api'],
      transform: 'daily_snapshot',
      dependents: ['macro_data', 'valuation_model', 'bond_pricing'],
      description: '10年期国债收益率',
      category: '宏观研究',
      last_updated: null,
      freshness_hours: 1
    },

    // === 风控相关 ===
    'liquidity_ratio': {
      source: ['cash_holdings', 'liquid_assets', 'total_assets'],
      transform: 'calculate_liquidity',
      dependents: ['dashboard_kpi', 'risk_alert', 'liquidity_stress_test'],
      description: '流动性资产占比',
      category: '流动性风险',
      last_updated: null,
      freshness_hours: 24
    },
    'var_95': {
      source: ['portfolio_positions', 'market_data', 'covariance_matrix'],
      transform: 'monte_carlo_var',
      dependents: ['risk_report', 'capital_allocation'],
      description: '95%置信度VaR',
      category: '风险计量',
      last_updated: null,
      freshness_hours: 24
    },

    // === 合规检查 ===
    'saa_compliance': {
      source: ['asset_allocation', 'regulatory_limits'],
      transform: 'check_compliance',
      dependents: ['dashboard_constraints', 'alert_system'],
      description: 'SAA合规检查结果',
      category: '合规管理',
      last_updated: null,
      freshness_hours: 24
    },

    // === TAA相关 ===
    'taa_scores': {
      source: ['macro_data', 'valuation_data', 'policy_data', 'fund_flow', 'technical_data'],
      transform: 'calculate_taa_scores',
      dependents: ['dashboard_taa', 'position_advice'],
      description: '战术配置五维评分',
      category: '战术配置',
      last_updated: null,
      freshness_hours: 4
    },

    // === 负债相关 ===
    'liability_cost': {
      source: ['policy_pricing', 'market_rates'],
      transform: 'calculate_avg_cost',
      dependents: ['spread', 'dashboard_liability'],
      description: '负债平均成本',
      category: '负债管理',
      last_updated: null,
      freshness_hours: 720  // 月度
    },
    'surrender_rate': {
      source: ['policy_admin_system'],
      transform: 'calculate_surrender',
      dependents: ['liability_report', 'cashflow_forecast'],
      description: '退保率',
      category: '负债管理',
      last_updated: null,
      freshness_hours: 720
    },
    'premium_growth': {
      source: ['new_business_data'],
      transform: 'calculate_growth',
      dependents: ['revenue_forecast'],
      description: '保费增长率',
      category: '负债管理',
      last_updated: null,
      freshness_hours: 720
    },

    // === 系统字段 ===
    'timestamp': {
      source: ['system_clock'],
      transform: 'iso_format',
      dependents: ['all_outputs'],
      description: '数据处理时间戳',
      category: '系统',
      last_updated: null,
      freshness_hours: 0.01
    },
    'data_quality_score': {
      source: ['quality_rules', 'extracted_data'],
      transform: 'quality_check',
      dependents: ['dashboard_quality_card'],
      description: '数据质量评分',
      category: '系统',
      last_updated: null,
      freshness_hours: 1
    }
  };

  // 更新时间戳
  function touch(fieldName) {
    if (lineage[fieldName]) {
      lineage[fieldName].last_updated = new Date().toISOString();
    }
  }

  // ============ 公共 API ============

  /**
   * 查询某个字段的血缘链路
   * @param {string} fieldName - 字段名
   * @returns {Object} 血缘信息，包含上游和下游
   */
  function getLineage(fieldName) {
    const node = lineage[fieldName];
    if (!node) {
      return { found: false, field: fieldName, message: '未找到该字段的血缘信息' };
    }

    // 追踪上游（递归）
    const upstream = [];
    const visited = new Set();

    function traceUp(name, depth) {
      if (visited.has(name) || depth > 10) return;
      visited.add(name);

      const n = lineage[name];
      if (!n) return;

      upstream.push({
        field: name,
        source: n.source,
        transform: n.transform,
        category: n.category,
        depth: depth
      });

      n.source.forEach(s => {
        if (lineage[s]) traceUp(s, depth + 1);
      });
    }

    traceUp(fieldName, 0);

    // 追踪下游
    const downstream = [];
    visited.clear();

    function traceDown(name, depth) {
      if (visited.has(name) || depth > 10) return;
      visited.add(name);

      const deps = lineage[name] ? lineage[name].dependents : [];
      deps.forEach(d => {
        if (lineage[d]) {
          downstream.push({
            field: d,
            description: lineage[d].description,
            category: lineage[d].category,
            depth: depth
          });
          traceDown(d, depth + 1);
        }
      });
    }

    traceDown(fieldName, 0);

    return {
      found: true,
      field: fieldName,
      description: node.description,
      category: node.category,
      source: node.source,
      transform: node.transform,
      dependents: node.dependents,
      last_updated: node.last_updated,
      upstream_chain: upstream,
      downstream_chain: downstream,
      upstream_count: upstream.length,
      downstream_count: downstream.length
    };
  }

  /**
   * 影响分析：修改某源数据会影响哪些下游字段
   * @param {string} sourceName - 源数据名
   * @returns {Object} 受影响的下游字段列表
   */
  function getImpact(sourceName) {
    const impacted = [];
    const visited = new Set();

    function propagate(fieldName) {
      if (visited.has(fieldName)) return;
      visited.add(fieldName);

      const node = lineage[fieldName];
      if (!node) return;

      impacted.push({
        field: fieldName,
        description: node.description,
        category: node.category
      });

      node.dependents.forEach(d => propagate(d));
    }

    // 找到所有直接从该source派生的字段
    Object.keys(lineage).forEach(fieldName => {
      const node = lineage[fieldName];
      if (node.source.includes(sourceName) && !visited.has(fieldName)) {
        propagate(fieldName);
      }
    });

    return {
      source: sourceName,
      total_impacted: impacted.length,
      impacted_fields: impacted,
      severity: impacted.length > 5 ? 'high' : impacted.length > 2 ? 'medium' : 'low'
    };
  }

  /**
   * 获取完整血缘图谱（用于可视化）
   */
  function getFullGraph() {
    const nodes = [];
    const edges = [];
    const nodeMap = {};

    Object.keys(lineage).forEach(key => {
      const node = lineage[key];
      if (!nodeMap[key]) {
        nodeMap[key] = {
          id: key,
          label: key,
          description: node.description,
          category: node.category,
          last_updated: node.last_updated
        };
        nodes.push(nodeMap[key]);
      }

      node.source.forEach(src => {
        edges.push({
          from: src,
          to: key,
          transform: node.transform,
          type: 'source'
        });
      });

      node.dependents.forEach(dep => {
        edges.push({
          from: key,
          to: dep,
          type: 'dependent'
        });
      });
    });

    // 去重边
    const edgeSet = new Set();
    const uniqueEdges = edges.filter(e => {
      const key = `${e.from}→${e.to}`;
      if (edgeSet.has(key)) return false;
      edgeSet.add(key);
      return true;
    });

    return {
      nodes: nodes,
      edges: uniqueEdges,
      total_nodes: nodes.length,
      total_edges: uniqueEdges.length
    };
  }

  /**
   * 按类别分组
   */
  function getByCategory() {
    const groups = {};
    Object.keys(lineage).forEach(key => {
      const cat = lineage[key].category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({
        field: key,
        description: lineage[key].description,
        last_updated: lineage[key].last_updated
      });
    });
    return groups;
  }

  /**
   * 获取新鲜度报告
   */
  function getFreshnessReport() {
    const now = new Date();
    const report = [];

    Object.keys(lineage).forEach(key => {
      const node = lineage[key];
      const status = node.last_updated
        ? (now - new Date(node.last_updated)) / 3600000 < node.freshness_hours
          ? 'fresh'
          : 'stale'
        : 'unknown';

      report.push({
        field: key,
        last_updated: node.last_updated,
        max_age_hours: node.freshness_hours,
        status: status
      });
    });

    return {
      total: report.length,
      fresh: report.filter(r => r.status === 'fresh').length,
      stale: report.filter(r => r.status === 'stale').length,
      unknown: report.filter(r => r.status === 'unknown').length,
      details: report
    };
  }

  /**
   * 批量更新时间戳
   */
  function batchTouch(fieldNames) {
    fieldNames.forEach(touch);
  }

  // ============ 导出 ============
  return {
    getLineage: getLineage,
    getImpact: getImpact,
    getFullGraph: getFullGraph,
    getByCategory: getByCategory,
    getFreshnessReport: getFreshnessReport,
    touch: touch,
    batchTouch: batchTouch,
    getAllFields: () => Object.keys(lineage),
    getNode: (name) => lineage[name] || null
  };
})();

if (typeof window !== 'undefined') {
  window.LineageTracker = LineageTracker;
}
