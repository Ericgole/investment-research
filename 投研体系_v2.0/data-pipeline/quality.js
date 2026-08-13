/**
 * Data Quality Checker - 数据质量检查系统
 * 10条质量规则，自动化检查报告
 * @version 1.0.0
 */

const QualityChecker = (function() {
  'use strict';

  // ============ 10条质量规则 ============
  const rules = [
    {
      id: 'Q001',
      field: 'solvency_ratio',
      name: '偿付能力范围检查',
      description: '偿付能力充足率应在100%-300%之间',
      check: 'range',
      min: 100,
      max: 300,
      severity: 'critical'
    },
    {
      id: 'Q002',
      field: 'nav',
      name: '净值非空检查',
      description: '基金净值不能为空',
      check: 'not_null',
      severity: 'critical'
    },
    {
      id: 'Q003',
      field: 'yield',
      name: '收益率范围检查',
      description: '收益率应在-50%到100%之间',
      check: 'range',
      min: -50,
      max: 100,
      severity: 'warning'
    },
    {
      id: 'Q004',
      field: 'timestamp',
      name: '数据新鲜度检查',
      description: '数据时间戳距今不应超过1小时',
      check: 'freshness',
      max_age_hours: 1,
      severity: 'warning'
    },
    {
      id: 'Q005',
      field: 'portfolio_total',
      name: '组合总规模一致性',
      description: '组合总规模应在合理范围（10亿-1000亿）',
      check: 'range',
      min: 1e9,
      max: 1e11,
      severity: 'critical'
    },
    {
      id: 'Q006',
      field: 'asset_allocation',
      name: '配置比例合计检查',
      description: '大类资产配置比例合计应为100%（容差±1%）',
      check: 'sum_to_100',
      tolerance: 1.0,
      severity: 'critical'
    },
    {
      id: 'Q007',
      field: 'duration_gap',
      name: '久期缺口范围检查',
      description: '久期缺口应在-5到5年之间',
      check: 'range',
      min: -5,
      max: 5,
      severity: 'warning'
    },
    {
      id: 'Q008',
      field: 'liquidity_ratio',
      name: '流动性比率检查',
      description: '流动性资产占比应在0-100%之间',
      check: 'range',
      min: 0,
      max: 1,
      severity: 'critical'
    },
    {
      id: 'Q009',
      field: 'data_completeness',
      name: '数据完整性检查',
      description: '关键字段完整率应≥95%',
      check: 'completeness',
      min: 0.95,
      severity: 'warning'
    },
    {
      id: 'Q010',
      field: 'cross_validation',
      name: '交叉验证检查',
      description: '关键指标交叉验证一致性',
      check: 'cross_validation',
      severity: 'info'
    }
  ];

  // ============ 检查函数 ============

  function checkRange(value, rule) {
    if (value === null || value === undefined) {
      return { passed: false, reason: '值为空' };
    }
    const num = Number(value);
    if (isNaN(num)) return { passed: false, reason: '非数值' };
    if (num < rule.min || num > rule.max) {
      return { passed: false, reason: `值 ${num} 超出范围 [${rule.min}, ${rule.max}]` };
    }
    return { passed: true, reason: '在范围内' };
  }

  function checkNotNull(value) {
    if (value === null || value === undefined || value === '') {
      return { passed: false, reason: '值为空' };
    }
    return { passed: true, reason: '非空' };
  }

  function checkFreshness(timestamp, rule) {
    if (!timestamp) return { passed: false, reason: '时间戳为空' };
    const age = (Date.now() - new Date(timestamp).getTime()) / 3600000;
    if (age > rule.max_age_hours) {
      return { passed: false, reason: `数据延迟 ${age.toFixed(1)} 小时` };
    }
    return { passed: true, reason: `新鲜 (${age.toFixed(1)}小时前)` };
  }

  function checkSumTo100(allocation, rule) {
    if (!allocation || typeof allocation !== 'object') {
      return { passed: false, reason: '配置数据不存在' };
    }
    const sum = Object.values(allocation).reduce((a, b) => a + (Number(b) || 0), 0) * 100;
    const diff = Math.abs(sum - 100);
    if (diff > rule.tolerance) {
      return { passed: false, reason: `配置合计 ${sum.toFixed(1)}%，偏离100%达${diff.toFixed(1)}%` };
    }
    return { passed: true, reason: `配置合计 ${sum.toFixed(1)}%` };
  }

  function checkCompleteness(data, rule) {
    if (!data || typeof data !== 'object') {
      return { passed: false, reason: '数据不存在' };
    }
    const requiredFields = [
      'solvency_ratio', 'portfolio_total', 'asset_allocation',
      'duration_gap', 'liquidity_ratio', 'yield_portfolio',
      'spread', 'macro_data', 'nav_data'
    ];

    let filled = 0;
    requiredFields.forEach(f => {
      if (data[f] !== undefined && data[f] !== null) filled++;
    });

    const ratio = filled / requiredFields.length;
    if (ratio < rule.min) {
      return {
        passed: false,
        reason: `完整率 ${(ratio * 100).toFixed(0)}%，低于${(rule.min * 100).toFixed(0)}%`
      };
    }
    return { passed: true, reason: `完整率 ${(ratio * 100).toFixed(0)}%` };
  }

  function checkCrossValidation(data) {
    // 交叉验证：偿付能力 = 资产/最低资本，检查一致性
    if (data.solvency_ratio && data.spread) {
      // 如果偿付能力高但利差为负，可能存在矛盾
      if (data.solvency_ratio > 150 && data.spread < 0) {
        return { passed: false, reason: '高偿付能力与负利差不一致，需人工核实' };
      }
    }

    // 检查久期缺口与配置的合理性
    if (data.duration_gap && data.asset_allocation) {
      const bondRatio = data.asset_allocation.bond || 0;
      if (Math.abs(data.duration_gap) > 3 && bondRatio > 0.8) {
        return { passed: false, reason: '久期缺口过大与高债券配置矛盾' };
      }
    }

    return { passed: true, reason: '交叉验证通过' };
  }

  // 检查函数映射
  const checkFunctions = {
    'range': checkRange,
    'not_null': checkNotNull,
    'freshness': checkFreshness,
    'sum_to_100': checkSumTo100,
    'completeness': checkCompleteness,
    'cross_validation': checkCrossValidation
  };

  // ============ 公共 API ============

  /**
   * 执行全部质量检查
   * @param {Object} data - 待检查数据（ETL输出）
   * @returns {Object} 检查报告
   */
  function runAllChecks(data) {
    const results = [];
    let passedCount = 0;
    let failedCount = 0;
    let warningCount = 0;

    rules.forEach(rule => {
      const checkFn = checkFunctions[rule.check];
      if (!checkFn) {
        results.push({
          rule_id: rule.id,
          field: rule.field,
          name: rule.name,
          passed: false,
          reason: '未知检查类型',
          severity: rule.severity
        });
        return;
      }

      // 从data中提取对应字段
      const value = extractField(data, rule.field);
      const result = checkFn(value, rule);

      results.push({
        rule_id: rule.id,
        field: rule.field,
        name: rule.name,
        description: rule.description,
        passed: result.passed,
        reason: result.reason,
        severity: rule.severity,
        value: typeof value === 'object' ? JSON.stringify(value).slice(0, 50) : value
      });

      if (result.passed) {
        passedCount++;
      } else {
        failedCount++;
        if (rule.severity !== 'info') {
          warningCount++;
        }
      }
    });

    const score = Math.round((passedCount / rules.length) * 100);

    return {
      timestamp: new Date().toISOString(),
      total_checks: rules.length,
      passed: passedCount,
      failed: failedCount,
      warnings: warningCount,
      score: score,
      status: score >= 90 ? '优秀' : score >= 70 ? '良好' : score >= 50 ? '需关注' : '不合格',
      failures: results.filter(r => !r.passed),
      details: results
    };
  }

  /**
   * 从数据对象中智能提取字段
   */
  function extractField(data, fieldName) {
    if (!data) return null;

    // 直接查找
    if (data[fieldName] !== undefined) return data[fieldName];

    // 扁平化查找
    const findIn = (obj, path) => {
      if (!obj || typeof obj !== 'object') return null;
      if (obj[path] !== undefined) return obj[path];

      for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          const found = findIn(val, path);
          if (found !== null) return found;
        }
      }
      return null;
    };

    return findIn(data, fieldName);
  }

  /**
   * 执行单条规则检查
   */
  function runSingleCheck(ruleId, data) {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return { error: `未找到规则 ${ruleId}` };

    const checkFn = checkFunctions[rule.check];
    const value = extractField(data, rule.field);
    const result = checkFn(value, rule);

    return {
      rule_id: rule.id,
      field: rule.field,
      name: rule.name,
      passed: result.passed,
      reason: result.reason,
      value: value
    };
  }

  /**
   * 获取所有规则定义
   */
  function getRules() {
    return rules.map(r => ({
      id: r.id,
      name: r.name,
      field: r.field,
      check: r.check,
      severity: r.severity
    }));
  }

  /**
   * 快速状态检查（只返回关键字段状态）
   */
  function quickCheck(data) {
    const criticalFields = ['solvency_ratio', 'duration_gap', 'liquidity_ratio', 'portfolio_total'];
    const results = {};

    criticalFields.forEach(field => {
      const rule = rules.find(r => r.field === field);
      if (rule) {
        const checkFn = checkFunctions[rule.check];
        const value = extractField(data, field);
        results[field] = checkFn(value, rule);
      }
    });

    return results;
  }

  // ============ 导出 ============
  return {
    runAll: runAllChecks,
    runSingle: runSingleCheck,
    getRules: getRules,
    quickCheck: quickCheck,
    allRules: rules
  };
})();

if (typeof window !== 'undefined') {
  window.QualityChecker = QualityChecker;
}
