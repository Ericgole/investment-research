/**
 * Alert Rules Engine - 预警规则引擎
 * 10条规则，阈值+趋势双维度
 * @version 1.0.0
 */

const AlertEngine = (function() {
  'use strict';

  // ============ 10条预警规则 ============
  const alertRules = [
    // === 偿付能力类 ===
    {
      id: 'ALERT-001',
      name: '偿付能力充足率跌破警戒线',
      category: 'solvency',
      type: 'threshold',
      field: 'solvency_ratio',
      condition: 'lt',
      threshold: 120,
      severity: 'critical',
      message: '偿付能力充足率{value}%已跌破120%监管红线，请立即采取增资或资产调整措施。'
    },
    {
      id: 'ALERT-002',
      name: '偿付能力充足率快速下降',
      category: 'solvency',
      type: 'trend',
      field: 'solvency_ratio',
      condition: 'drop_over_period',
      period_days: 7,
      threshold: 10,
      severity: 'warning',
      message: '偿付能力充足率近7天下降{change}个百分点，趋势恶化，请关注。'
    },

    // === 久期缺口类 ===
    {
      id: 'ALERT-003',
      name: '久期缺口突破容忍区间',
      category: 'duration',
      type: 'threshold',
      field: 'duration_gap',
      condition: 'outside_range',
      min: -3,
      max: 3,
      severity: 'warning',
      message: '久期缺口{value}年超出[-3, +3]容忍区间，利率风险敞口扩大。'
    },

    // === SAA偏离类 ===
    {
      id: 'ALERT-004',
      name: 'SAA配置偏离目标超5%',
      category: 'saa',
      type: 'threshold',
      field: 'saa_deviation',
      condition: 'gt',
      threshold: 5,
      severity: 'warning',
      message: '大类资产配置偏离目标{value}%，超过5%阈值，需启动再平衡流程。'
    },

    // === 流动性类 ===
    {
      id: 'ALERT-005',
      name: '流动性覆盖率低于监管要求',
      category: 'liquidity',
      type: 'threshold',
      field: 'liquidity_ratio',
      condition: 'lt',
      threshold: 0.05,
      severity: 'critical',
      message: '流动性资产占比{value}%低于监管要求5%，存在兑付风险。'
    },
    {
      id: 'ALERT-006',
      name: '高流动性资产占比过低',
      category: 'liquidity',
      type: 'threshold',
      field: 'liquid_asset_ratio',
      condition: 'lt',
      threshold: 10,
      severity: 'warning',
      message: '高流动性资产占比{value}%低于10%，应急变现能力不足。'
    },

    // === 投资绩效类 ===
    {
      id: 'ALERT-007',
      name: '组合收益跑输基准超3%',
      category: 'performance',
      type: 'threshold',
      field: 'excess_return',
      condition: 'lt',
      threshold: -3,
      severity: 'warning',
      message: '组合收益跑输基准{value}%，连续落后需检视投资策略。'
    },
    {
      id: 'ALERT-008',
      name: '单只基金回撤超15%',
      category: 'performance',
      type: 'threshold',
      field: 'fund_drawdown',
      condition: 'gt',
      threshold: 15,
      severity: 'info',
      message: '持仓基金回撤{value}%，超过15%阈值，建议关注。'
    },

    // === 宏观/市场类 ===
    {
      id: 'ALERT-009',
      name: '10年期国债收益率剧烈波动',
      category: 'market',
      type: 'trend',
      field: 'bond_10y',
      condition: 'change_over_period',
      period_days: 1,
      threshold: 0.2,
      severity: 'info',
      message: '10年期国债收益率单日波动{change}bp，市场利率风险上升。'
    },

    // === 数据质量类 ===
    {
      id: 'ALERT-010',
      name: '数据质量评分低于80分',
      category: 'data',
      type: 'threshold',
      field: 'data_quality_score',
      condition: 'lt',
      threshold: 80,
      severity: 'warning',
      message: '数据质量评分{value}分低于80分，部分指标可能不可靠。'
    }
  ];

  // ============ 条件检查函数 ============

  function checkThreshold(rule, value) {
    const num = Number(value);
    if (isNaN(num)) return { triggered: false, reason: '值不可解析' };

    switch (rule.condition) {
      case 'lt':
        return {
          triggered: num < rule.threshold,
          value: num,
          threshold: rule.threshold
        };
      case 'gt':
        return {
          triggered: num > rule.threshold,
          value: num,
          threshold: rule.threshold
        };
      case 'lte':
        return {
          triggered: num <= rule.threshold,
          value: num,
          threshold: rule.threshold
        };
      case 'gte':
        return {
          triggered: num >= rule.threshold,
          value: num,
          threshold: rule.threshold
        };
      case 'outside_range':
        return {
          triggered: num < (rule.min || -Infinity) || num > (rule.max || Infinity),
          value: num,
          min: rule.min,
          max: rule.max
        };
      default:
        return { triggered: false, reason: '未知条件类型' };
    }
  }

  function checkTrend(rule, data) {
    // 从历史数据中获取趋势
    let history = [];
    try {
      if (window.MockDataGenerator) {
        const fullHistory = MockDataGenerator.getHistory(30);
        const fieldMap = {
          'solvency_ratio': 'solvency_ratio',
          'bond_10y': 'bond_10y'
        };
        const mappedField = fieldMap[rule.field] || rule.field;
        history = fullHistory.map(function(d) {
          return { date: d.date, value: d[mappedField] };
        });
      }
    } catch (e) {
      // 降级：无历史数据时跳过趋势检查
      return { triggered: false, reason: '无历史数据' };
    }

    if (history.length < rule.period_days) {
      return { triggered: false, reason: '历史数据不足' };
    }

    const recent = history.slice(-rule.period_days);
    const first = Number(recent[0].value);
    const last = Number(recent[recent.length - 1].value);

    if (isNaN(first) || isNaN(last)) {
      return { triggered: false, reason: '数据不可解析' };
    }

    switch (rule.condition) {
      case 'drop_over_period': {
        const drop = first - last;
        return {
          triggered: drop > rule.threshold,
          change: Number(drop.toFixed(1)),
          threshold: rule.threshold,
          period_days: rule.period_days,
          first_value: first,
          last_value: last
        };
      }
      case 'change_over_period': {
        const change = Math.abs(last - first);
        return {
          triggered: change > rule.threshold,
          change: Number((change * 100).toFixed(0)),
          threshold: rule.threshold * 100,
          period_days: rule.period_days,
          first_value: first,
          last_value: last
        };
      }
      default:
        return { triggered: false, reason: '未知趋势条件' };
    }
  }

  function extractField(data, fieldName) {
    if (!data) return null;
    if (data[fieldName] !== undefined) return data[fieldName];

    // 扁平查找
    for (var key in data) {
      if (data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])) {
        var found = extractField(data[key], fieldName);
        if (found !== null) return found;
      }
    }
    return null;
  }

  // ============ 公共 API ============

  /**
   * 单条规则检查
   */
  function check(rule, data) {
    if (rule.type === 'trend') {
      var result = checkTrend(rule, data);
      var value = result.change !== undefined ? result.change : 'N/A';

      if (result.triggered) {
        return {
          triggered: true,
          rule_id: rule.id,
          severity: rule.severity,
          category: rule.category,
          name: rule.name,
          message: rule.message
            .replace(/\{change\}/g, result.change || 'N/A')
            .replace(/\{value\}/g, value),
          field: rule.field,
          current_value: value,
          detail: result
        };
      }
      return { triggered: false, rule_id: rule.id };
    }

    // 阈值类型
    var val = extractField(data, rule.field);
    var result = checkThreshold(rule, val);

    if (result.triggered) {
      var displayValue = result.value;
      // 流动性比率转百分比
      if (rule.field === 'liquidity_ratio' && typeof displayValue === 'number') {
        displayValue = (displayValue * 100).toFixed(1);
      }

      return {
        triggered: true,
        rule_id: rule.id,
        severity: rule.severity,
        category: rule.category,
        name: rule.name,
        message: rule.message.replace(/\{value\}/g, displayValue),
        field: rule.field,
        current_value: displayValue,
        detail: result
      };
    }

    return { triggered: false, rule_id: rule.id };
  }

  /**
   * 批量检查所有规则
   */
  function checkAll(data) {
    // 补充衍生字段
    var enriched = Object.assign({}, data);
    if (data.risk && data.risk.liquidity_ratio !== undefined) {
      enriched.liquidity_ratio = data.risk.liquidity_ratio;
    }
    if (data.solvency) {
      enriched.solvency_ratio = data.solvency.comprehensive_ratio;
    }
    if (data.duration) {
      enriched.duration_gap = data.duration.gap;
    }
    enriched.liquid_asset_ratio = enriched.liquidity_ratio
      ? (enriched.liquidity_ratio * 100)
      : 5;
    enriched.fund_drawdown = 8;  // 模拟
    enriched.excess_return = -1.2;  // 模拟
    enriched.data_quality_score = 85;  // 模拟
    enriched.saa_deviation = 3;  // 模拟

    // 尝试从QualityChecker获取真实分数
    if (window.QualityChecker && data._meta) {
      try {
        var qr = QualityChecker.runAll(data);
        enriched.data_quality_score = qr.score;
      } catch (e) {}
    }

    return alertRules.map(function(rule) {
      return check(rule, enriched);
    });
  }

  /**
   * 获取触发的预警
   */
  function getTriggered(data) {
    return checkAll(data).filter(function(r) { return r.triggered; });
  }

  /**
   * 按严重级别过滤规则
   */
  function getRulesBySeverity(severity) {
    return alertRules.filter(function(r) { return r.severity === severity; });
  }

  /**
   * 按类别过滤规则
   */
  function getRulesByCategory(category) {
    return alertRules.filter(function(r) { return r.category === category; });
  }

  /**
   * 获取所有规则定义
   */
  function getAllRules() {
    return alertRules.map(function(r) {
      return {
        id: r.id,
        name: r.name,
        category: r.category,
        type: r.type,
        severity: r.severity
      };
    });
  }

  return {
    check: check,
    checkAll: checkAll,
    getTriggered: getTriggered,
    getRulesBySeverity: getRulesBySeverity,
    getRulesByCategory: getRulesByCategory,
    getAllRules: getAllRules,
    rules: alertRules
  };
})();

if (typeof window !== 'undefined') {
  window.AlertEngine = AlertEngine;
}
