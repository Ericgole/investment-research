/**
 * ETL Core - 保险资金投研数据管道
 * 提供 Extract → Transform → Load 三阶段标准流程
 * 纯前端实现，不依赖后端服务
 * @version 1.0.0
 */

const DataPipeline = (function() {
  'use strict';

  // ============ 配置 ============
  const CONFIG = {
    maxRetries: 3,
    outputDir: 'data-pipeline/output/',
    retentionDays: 30,
    lastFetchPath: 'data-pipeline/last_fetch.json'
  };

  // ============ 内部状态 ============
  let lastFetchTimes = {};
  let cache = {};

  // ============ 工具函数 ============
  function timestamp() {
    return new Date().toISOString();
  }

  function dateStr(date) {
    const d = date || new Date();
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  }

  function standardize(source, rawData, meta) {
    return {
      source: source,
      timestamp: timestamp(),
      data: rawData,
      metadata: Object.assign({
        version: '1.0',
        pipeline: 'etl-core'
      }, meta || {})
    };
  }

  // ============ EXTRACT 层 ============

  /**
   * Wind API 抽取器（模拟）
   * 抽取偿付能力、债券收益率等金融数据
   */
  async function extractWindAPI(retryCount = 0) {
    try {
      const lastFetch = lastFetchTimes['wind_api'] || null;
      const data = window.MockDataGenerator
        ? MockDataGenerator.getLatest('wind')
        : {
            solvency_ratio: 132,
            core_ratio: 118,
            bond_10y: 1.72,
            bond_5y: 1.55,
            bond_2y: 1.38,
            stock_index: 3280,
            cny_usd: 7.25
          };

      lastFetchTimes['wind_api'] = timestamp();
      return standardize('wind_api', data, {
        method: 'mock',
        rate_limit: '100/min',
        last_fetch: lastFetch
      });
    } catch (err) {
      if (retryCount < CONFIG.maxRetries) {
        console.warn(`[ETL] wind_api retry ${retryCount + 1}/${CONFIG.maxRetries}`);
        await sleep(1000 * (retryCount + 1));
        return extractWindAPI(retryCount + 1);
      }
      throw new Error(`[ETL] wind_api 抽取失败: ${err.message}`);
    }
  }

  /**
   * 基金估值抽取器（模拟）
   * 抽取持仓基金净值数据
   */
  async function extractFundValuation(retryCount = 0) {
    try {
      const data = window.MockDataGenerator
        ? MockDataGenerator.getLatest('funds')
        : {
            funds: [
              { code: '510300', name: '沪深300ETF', nav: 4.125, change: 0.8, weight: 0.12 },
              { code: '510500', name: '中证500ETF', nav: 6.830, change: 1.2, weight: 0.06 },
              { code: '511260', name: '10年国债ETF', nav: 102.45, change: -0.1, weight: 0.35 },
              { code: '511010', name: '5年国债ETF', nav: 101.20, change: -0.05, weight: 0.20 },
              { code: '518880', name: '黄金ETF', nav: 5.68, change: 0.3, weight: 0.10 },
              { code: '513100', name: '纳指ETF', nav: 2.45, change: 1.5, weight: 0.10 },
              { code: '511270', name: '信用债ETF', nav: 100.89, change: 0.05, weight: 0.07 }
            ],
            total_nav: null
          };

      // 计算总净值
      data.total_nav = data.funds.reduce((sum, f) => sum + f.nav * f.weight * 100, 0);

      lastFetchTimes['fund_valuation'] = timestamp();
      return standardize('fund_valuation', data, {
        method: 'mock',
        fund_count: data.funds.length
      });
    } catch (err) {
      if (retryCount < CONFIG.maxRetries) {
        await sleep(1000 * (retryCount + 1));
        return extractFundValuation(retryCount + 1);
      }
      throw new Error(`[ETL] fund_valuation 抽取失败: ${err.message}`);
    }
  }

  /**
   * 宏观经济数据抽取器（模拟）
   * 抽取GDP、CPI、利率等宏观指标
   */
  async function extractMacroData(retryCount = 0) {
    try {
      const data = window.MockDataGenerator
        ? MockDataGenerator.getLatest('macro')
        : {
            gdp: 5.2,
            gdp_target: 5.0,
            cpi: 2.1,
            ppi: -1.5,
            pmi: 49.5,
            m2: 10.5,
            social_financing: 3.2,
            rate_10y: 1.72,
            rate_1y_lpr: 3.45,
            rate_5y_lpr: 3.95,
            reserve_ratio: 7.0
          };

      lastFetchTimes['macro_data'] = timestamp();
      return standardize('macro_data', data, {
        method: 'mock',
        source_org: '央行/统计局'
      });
    } catch (err) {
      if (retryCount < CONFIG.maxRetries) {
        await sleep(1000 * (retryCount + 1));
        return extractMacroData(retryCount + 1);
      }
      throw new Error(`[ETL] macro_data 抽取失败: ${err.message}`);
    }
  }

  /**
   * 组合持仓抽取器（模拟）
   * 抽取当前投资组合配置
   */
  async function extractPortfolio(retryCount = 0) {
    try {
      const data = window.MockDataGenerator
        ? MockDataGenerator.getLatest('portfolio')
        : {
            total_aum: 5e9,       // 50亿总规模
            allocation: {
              equity: 0.18,       // 权益18%
              bond: 0.65,         // 固收65%
              alternative: 0.12,  // 另类12%
              cash: 0.05          // 流动性5%
            },
            holdings: 7,
            duration_asset: 3.8,
            duration_liability: 7.0,
            duration_gap: -3.2,
            yield_portfolio: 4.20,
            cost_liability: 3.50,
            spread: 0.70,
            liquidity_ratio: 0.05,
            single_concentration: 0.08,
            overseas_ratio: 0.12,
            real_estate_ratio: 0.08
          };

      lastFetchTimes['portfolio'] = timestamp();
      return standardize('portfolio', data, {
        method: 'mock',
        table: 'holdings'
      });
    } catch (err) {
      if (retryCount < CONFIG.maxRetries) {
        await sleep(1000 * (retryCount + 1));
        return extractPortfolio(retryCount + 1);
      }
      throw new Error(`[ETL] portfolio 抽取失败: ${err.message}`);
    }
  }

  // 抽取器注册表
  const extractors = {
    wind_api: extractWindAPI,
    fund_valuation: extractFundValuation,
    macro_data: extractMacroData,
    portfolio: extractPortfolio
  };

  // ============ TRANSFORM 层 ============

  /**
   * 计算收益率
   */
  function calculateYield(navData) {
    const funds = navData.data.funds;
    const weightedReturn = funds.reduce((sum, f) => {
      return sum + (f.change / 100) * f.weight;
    }, 0);

    return {
      daily_return: weightedReturn,
      weekly_return: weightedReturn * 5,   // 近似
      monthly_return: weightedReturn * 21,  // 近似
      annual_return: weightedReturn * 252,  // 年化
      fund_count: funds.length,
      best_fund: funds.reduce((a, b) => a.change > b.change ? a : b),
      worst_fund: funds.reduce((a, b) => a.change < b.change ? a : b)
    };
  }

  /**
   * 计算风险指标
   */
  function calculateRiskMetrics(portfolioData) {
    const p = portfolioData.data;
    return {
      duration_gap: p.duration_gap,
      duration_asset: p.duration_asset,
      duration_liability: p.duration_liability,
      gap_status: Math.abs(p.duration_gap) <= 1.5 ? 'normal' : 'alert',
      liquidity_ratio: p.liquidity_ratio,
      liquidity_status: p.liquidity_ratio >= 0.05 ? 'normal' : 'alert',
      var_95: -0.012,     // 模拟 95% VAR
      cvar_95: -0.018,    // 模拟 CVAR
      sharpe: 0.85,        // 模拟夏普比率
      max_drawdown: -0.08  // 模拟最大回撤
    };
  }

  /**
   * SAA 合规性检查
   */
  function complianceCheck(portfolioData) {
    const p = portfolioData.data;
    const rules = [
      { name: '权益上限', current: p.allocation.equity * 100, limit: 45, op: '<=', passed: p.allocation.equity <= 0.45 },
      { name: '单一集中度', current: p.single_concentration * 100, limit: 10, op: '<=', passed: p.single_concentration <= 0.10 },
      { name: '境外投资', current: p.overseas_ratio * 100, limit: 15, op: '<=', passed: p.overseas_ratio <= 0.15 },
      { name: '不动产', current: p.real_estate_ratio * 100, limit: 30, op: '<=', passed: p.real_estate_ratio <= 0.30 },
      { name: '流动性', current: p.liquidity_ratio * 100, limit: 5, op: '>=', passed: p.liquidity_ratio >= 0.05 }
    ];

    const allPassed = rules.every(r => r.passed);
    const violations = rules.filter(r => !r.passed);

    return {
      all_pass: allPassed,
      violations: violations,
      violation_count: violations.length,
      details: rules
    };
  }

  /**
   * 格式化为前端所需格式
   */
  function formatForDisplay(extractedData) {
    const wind = extractedData.wind_api;
    const portfolio = extractedData.portfolio;
    const funds = extractedData.fund_valuation;
    const macro = extractedData.macro_data;

    return {
      // 偿付能力 KPI
      solvency: {
        core_ratio: wind.data.core_ratio || 118,
        comprehensive_ratio: wind.data.solvency_ratio || 132,
        status: (wind.data.solvency_ratio || 132) >= 120 ? '安全' : '关注',
        change_monthly: 2.0,
        detail: `核心: ${wind.data.core_ratio || 118}% | 综合: ${wind.data.solvency_ratio || 132}%`
      },

      // 久期缺口
      duration: {
        gap: portfolio.data.duration_gap || -3.2,
        asset: portfolio.data.duration_asset || 3.8,
        liability: portfolio.data.duration_liability || 7.0,
        target: 1.5,
        status: Math.abs(portfolio.data.duration_gap || -3.2) <= 1.5 ? '正常' : '关注',
        change_monthly: 0.3
      },

      // 利差
      spread: {
        value: (portfolio.data.spread || 0.70) * 100,  // 转为bp
        cost: portfolio.data.cost_liability || 3.50,
        yield_val: portfolio.data.yield_portfolio || 4.20,
        status: (portfolio.data.spread || 0.70) >= 0 ? '利差益' : '利差损',
        change_monthly: 15
      },

      // 综合收益率
      portfolio_return: {
        value: portfolio.data.yield_portfolio || 4.20,
        ytd: 1.4,
        year1: 4.2,
        status: (portfolio.data.yield_portfolio || 4.20) >= 3.5 ? '达标' : '不达标',
        change_monthly: 0.3
      },

      // SAA 配置
      saa: {
        allocation: portfolio.data.allocation,
        constraints: complianceCheck(portfolio)
      },

      // 基金持仓
      funds: funds.data.funds || [],

      // 宏观
      macro: macro.data,

      // TAA 评分
      taa_scores: {
        macro_score: Math.round((macro.data.pmi || 49.5) * 1.2),
        valuation_score: 55,
        policy_score: 50,
        fund_flow_score: 45,
        technical_score: 52
      },

      // 负债指标
      liability: {
        cost: portfolio.data.cost_liability || 3.50,
        duration: portfolio.data.duration_liability || 7.0,
        new_biz_cost: 3.2,
        surrender_rate: 2.1,
        premium_growth: 8.5
      },

      // 风险指标
      risk: calculateRiskMetrics(portfolio),

      // 收益率分析
      yield_analysis: calculateYield(funds)
    };
  }

  // 转换函数注册表
  const transforms = {
    calculate_yield: calculateYield,
    risk_metrics: calculateRiskMetrics,
    compliance_check: complianceCheck,
    format_for_display: formatForDisplay
  };

  // ============ LOAD 层 ============

  /**
   * 将数据保存到 output 目录（模拟为内存缓存 + localStorage）
   */
  function saveToOutput(date, data) {
    const key = `dashboard-data-${date}`;
    const payload = {
      timestamp: timestamp(),
      date: date,
      data: data
    };

    // 存储到缓存和 localStorage
    cache[key] = payload;
    try {
      localStorage.setItem(key, JSON.stringify(payload));
    } catch (e) {
      console.warn('[ETL] localStorage 存储失败:', e.message);
    }

    // 清理过期数据（保留最近30天）
    cleanupOldData();

    return payload;
  }

  /**
   * 清理超过保留期限的数据
   */
  function cleanupOldData() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - CONFIG.retentionDays);
    const cutoffStr = dateStr(cutoff);

    // 清理 localStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('dashboard-data-')) {
          const datePart = key.replace('dashboard-data-', '');
          if (datePart < cutoffStr) {
            localStorage.removeItem(key);
          }
        }
      }
    } catch (e) {
      // ignore
    }

    // 清理内存缓存
    Object.keys(cache).forEach(key => {
      const datePart = key.replace('dashboard-data-', '');
      if (datePart < cutoffStr) {
        delete cache[key];
      }
    });
  }

  /**
   * 按日期加载数据
   */
  function load(date) {
    const d = typeof date === 'string' ? date : dateStr(date);
    const key = `dashboard-data-${d}`;

    // 先查内存缓存
    if (cache[key]) {
      return Promise.resolve(cache[key]);
    }

    // 再查 localStorage
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        cache[key] = parsed;
        return Promise.resolve(parsed);
      }
    } catch (e) {
      // ignore
    }

    return Promise.reject(new Error(`[ETL] 未找到 ${d} 的数据`));
  }

  /**
   * 获取所有可用日期
   */
  function getAvailableDates() {
    const dates = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('dashboard-data-')) {
          dates.push(key.replace('dashboard-data-', ''));
        }
      }
    } catch (e) {
      // ignore
    }
    return dates.sort().reverse();
  }

  // ============ 公共接口 ============

  /**
   * 完整ETL流水线
   * @param {Array} sources - 要抽取的数据源列表，默认全部
   * @returns {Object} 格式化后的仪表盘数据
   */
  async function runETL(sources) {
    const sourceList = sources || Object.keys(extractors);
    const extracted = {};
    const errors = [];

    console.log(`[ETL] 开始抽取 ${sourceList.length} 个数据源...`);

    // Phase 1: Extract - 并行抽取
    const extractPromises = sourceList.map(async (name) => {
      if (!extractors[name]) {
        errors.push({ source: name, error: '未知数据源' });
        return;
      }
      try {
        const result = await extractors[name]();
        extracted[name] = result;
        console.log(`[ETL] ✓ ${name} 抽取成功`);
      } catch (err) {
        errors.push({ source: name, error: err.message });
        console.error(`[ETL] ✗ ${name} 抽取失败:`, err.message);
      }
    });

    await Promise.all(extractPromises);

    if (Object.keys(extracted).length === 0) {
      throw new Error('[ETL] 所有数据源抽取失败');
    }

    // Phase 2: Transform - 格式化为前端数据
    console.log('[ETL] 开始转换...');
    const displayData = transforms.format_for_display(extracted);

    // 附加转换结果
    displayData._meta = {
      pipeline_version: '1.0.0',
      sources_used: Object.keys(extracted),
      sources_failed: errors.map(e => e.source),
      extract_timestamp: timestamp()
    };

    // Phase 3: Load - 保存
    const today = dateStr();
    const saved = saveToOutput(today, displayData);
    console.log(`[ETL] 数据已保存: ${saved.date}`);

    return {
      success: errors.length === 0,
      data: displayData,
      errors: errors,
      date: today,
      saved: saved
    };
  }

  /**
   * 增量抽取（仅抽取自上次以来有更新的数据源）
   */
  async function runIncrementalETL() {
    // 检查哪些数据源需要更新
    const now = new Date();
    const sourcesToUpdate = Object.keys(extractors).filter(name => {
      const lastFetch = lastFetchTimes[name];
      if (!lastFetch) return true;
      const elapsed = now - new Date(lastFetch);
      return elapsed > 60 * 60 * 1000; // 超过1小时
    });

    if (sourcesToUpdate.length === 0) {
      console.log('[ETL] 所有数据源均无更新需求');
      return { success: true, updated: false, message: '无需更新' };
    }

    console.log(`[ETL] 增量更新 ${sourcesToUpdate.length} 个数据源`);
    return runETL(sourcesToUpdate);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============ 导出 ============
  return {
    // 核心流水线
    run: runETL,
    runIncremental: runIncrementalETL,

    // 抽取层
    extractors: extractors,
    extract: (name) => extractors[name] ? extractors[name]() : Promise.reject('未找到抽取器'),

    // 转换层
    transforms: transforms,
    formatForDisplay: formatForDisplay,

    // 加载层
    load: load,
    save: saveToOutput,
    getAvailableDates: getAvailableDates,

    // 工具
    getLastFetchTimes: () => Object.assign({}, lastFetchTimes),
    getCache: () => cache,
    clearCache: () => { cache = {}; },
    getConfig: () => CONFIG
  };
})();

// 挂载到 window
if (typeof window !== 'undefined') {
  window.DataPipeline = DataPipeline;
}
