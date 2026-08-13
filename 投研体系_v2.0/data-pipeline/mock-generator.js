/**
 * Mock Data Generator - 模拟数据生成器
 * 生成合理的30天历史数据，趋势连贯
 * 确保数据变化符合市场逻辑
 * @version 1.0.0
 */

const MockDataGenerator = (function() {
  'use strict';

  // ============ 基准数据（锚点） ============
  const BASELINE = {
    solvency_ratio: 132,
    core_ratio: 118,
    bond_10y: 1.72,
    bond_5y: 1.55,
    bond_2y: 1.38,
    stock_index: 3280,
    cny_usd: 7.25,
    gdp: 5.2,
    cpi: 2.1,
    ppi: -1.5,
    pmi: 49.5,
    m2: 10.5,
    social_financing: 3.2,
    rate_10y: 1.72,
    rate_1y_lpr: 3.45,
    rate_5y_lpr: 3.95,
    reserve_ratio: 7.0,
    total_aum: 5e9,
    allocation: { equity: 0.18, bond: 0.65, alternative: 0.12, cash: 0.05 },
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

  const FUNDS_BASELINE = [
    { code: '510300', name: '沪深300ETF', nav: 4.125, change: 0.8, weight: 0.12 },
    { code: '510500', name: '中证500ETF', nav: 6.830, change: 1.2, weight: 0.06 },
    { code: '511260', name: '10年国债ETF', nav: 102.45, change: -0.1, weight: 0.35 },
    { code: '511010', name: '5年国债ETF', nav: 101.20, change: -0.05, weight: 0.20 },
    { code: '518880', name: '黄金ETF', nav: 5.68, change: 0.3, weight: 0.10 },
    { code: '513100', name: '纳指ETF', nav: 2.45, change: 1.5, weight: 0.10 },
    { code: '511270', name: '信用债ETF', nav: 100.89, change: 0.05, weight: 0.07 }
  ];

  // ============ 随机工具 ============
  function randNormal(mean, std) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    // Box-Muller
    let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mean + z * std;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // ============ 单日数据生成 ============

  /**
   * 在基准值附近生成合理的单日数据
   * 使用布朗运动模拟确保趋势连贯
   */
  function generateOneDay(date, prevDay) {
    const dayIndex = prevDay ? (prevDay._dayIndex || 0) + 1 : 0;

    // 偿付能力：缓慢均值回归，日波动0.1-0.3%
    const solvencyTrend = Math.sin(dayIndex * 0.05) * 2;
    const solvency = prevDay
      ? clamp(prevDay.solvency_ratio + randNormal(solvencyTrend * 0.01, 0.15), 118, 145)
      : BASELINE.solvency_ratio + randNormal(0, 0.5);

    const coreRatio = solvency - 14 + randNormal(0, 0.2);

    // 10年国债：缓慢上行趋势（模拟加息周期）
    const bondTrend = 0.0005 * dayIndex;
    const bond10y = prevDay
      ? clamp(prevDay.bond_10y + randNormal(0.002, 0.015), 1.55, 1.95)
      : BASELINE.bond_10y + bondTrend + randNormal(0, 0.01);

    // 久期缺口：资产久期短于负债(负缺口)，缓慢缩窄(向0靠拢)
    const gapTrend = 0.002 * dayIndex;
    const durationGap = prevDay
      ? clamp(prevDay.duration_gap + randNormal(gapTrend, 0.04), -3.8, -2.4)
      : BASELINE.duration_gap + randNormal(0, 0.05);

    // 组合收益率：缓慢变化
    const yieldVal = prevDay
      ? clamp(prevDay.yield_portfolio + randNormal(0.001, 0.02), 3.8, 4.5)
      : BASELINE.yield_portfolio + randNormal(0, 0.03);

    // 利差 = 收益率 - 负债成本
    const spread = yieldVal - BASELINE.cost_liability;

    // PMI：在49-51间波动
    const pmi = clamp(prevDay ? prevDay.pmi + randNormal(0, 0.05) : BASELINE.pmi, 48.5, 51.5);

    // CPI：缓慢变化
    const cpi = clamp(prevDay ? prevDay.cpi + randNormal(0, 0.02) : BASELINE.cpi, 1.5, 3.0);

    // 流动性比率：缓慢变化
    const liquidity = prevDay
      ? clamp(prevDay.liquidity_ratio + randNormal(0, 0.002), 0.03, 0.08)
      : BASELINE.liquidity_ratio;

    // 基金净值变化
    const fundChanges = FUNDS_BASELINE.map(f => {
      const volatility = f.weight > 0.2 ? 0.15 : f.weight > 0.1 ? 0.25 : 0.4;
      return randNormal(f.change / 100, volatility);
    });

    const funds = FUNDS_BASELINE.map((f, i) => ({
      code: f.code,
      name: f.name,
      nav: parseFloat((f.nav * (1 + fundChanges[i] / 100)).toFixed(3)),
      change: parseFloat(fundChanges[i].toFixed(2)),
      weight: f.weight
    }));

    return {
      _dayIndex: dayIndex,
      date: date || new Date().toISOString().slice(0, 10),
      solvency_ratio: parseFloat(solvency.toFixed(1)),
      core_ratio: parseFloat(coreRatio.toFixed(1)),
      bond_10y: parseFloat(bond10y.toFixed(3)),
      bond_5y: parseFloat((bond10y - 0.17 + randNormal(0, 0.01)).toFixed(3)),
      bond_2y: parseFloat((bond10y - 0.34 + randNormal(0, 0.01)).toFixed(3)),
      stock_index: prevDay
        ? Math.round(clamp(prevDay.stock_index + randNormal(0, 15), 3100, 3450))
        : BASELINE.stock_index + Math.round(randNormal(0, 10)),
      cny_usd: parseFloat(clamp(prevDay ? prevDay.cny_usd + randNormal(0, 0.005) : BASELINE.cny_usd, 7.1, 7.4).toFixed(2)),
      gdp: BASELINE.gdp,
      cpi: parseFloat(cpi.toFixed(1)),
      ppi: parseFloat(clamp(BASELINE.ppi + randNormal(0, 0.1), -2.5, 0).toFixed(1)),
      pmi: parseFloat(pmi.toFixed(1)),
      m2: parseFloat(clamp(BASELINE.m2 + randNormal(0, 0.1), 9.5, 11.5).toFixed(1)),
      social_financing: parseFloat(clamp(BASELINE.social_financing + randNormal(0, 0.05), 2.5, 4.0).toFixed(1)),
      rate_1y_lpr: BASELINE.rate_1y_lpr,
      rate_5y_lpr: BASELINE.rate_5y_lpr,
      reserve_ratio: BASELINE.reserve_ratio,
      total_aum: BASELINE.total_aum,
      allocation: { ...BASELINE.allocation },
      duration_asset: parseFloat((BASELINE.duration_asset + randNormal(0, 0.01)).toFixed(1)),
      duration_liability: parseFloat((BASELINE.duration_liability + randNormal(0, 0.005)).toFixed(1)),
      duration_gap: parseFloat(durationGap.toFixed(2)),
      yield_portfolio: parseFloat(yieldVal.toFixed(2)),
      cost_liability: BASELINE.cost_liability,
      spread: parseFloat(spread.toFixed(2)),
      liquidity_ratio: parseFloat(liquidity.toFixed(3)),
      single_concentration: BASELINE.single_concentration,
      overseas_ratio: BASELINE.overseas_ratio,
      real_estate_ratio: BASELINE.real_estate_ratio,
      funds: funds,
      holdings: 7
    };
  }

  // ============ 历史数据生成 ============

  /**
   * 生成最近N天历史数据
   * @param {number} days - 天数
   * @returns {Array} 按日期排序的数据数组
   */
  function generateHistory(days) {
    const history = [];
    let prevDay = null;

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayData = generateOneDay(date.toISOString().slice(0, 10), prevDay);
      history.push(dayData);
      prevDay = dayData;
    }

    return history;
  }

  // ============ 分类数据获取 ============

  // 缓存最近生成的历史
  let cachedHistory = null;

  function getHistory(days) {
    if (!cachedHistory || cachedHistory.length < days) {
      cachedHistory = generateHistory(Math.max(days, 30));
    }
    return cachedHistory.slice(-days);
  }

  /**
   * 获取最新数据（按类别）
   * @param {string} category - 'wind' | 'funds' | 'macro' | 'portfolio' | 'all'
   */
  function getLatest(category) {
    const history = getHistory(30);
    const latest = history[history.length - 1];

    switch (category) {
      case 'wind':
        return {
          solvency_ratio: latest.solvency_ratio,
          core_ratio: latest.core_ratio,
          bond_10y: latest.bond_10y,
          bond_5y: latest.bond_5y,
          bond_2y: latest.bond_2y,
          stock_index: latest.stock_index,
          cny_usd: latest.cny_usd
        };

      case 'funds':
        return {
          funds: latest.funds,
          total_nav: latest.funds.reduce((sum, f) => sum + f.nav * f.weight * 100, 0)
        };

      case 'macro':
        return {
          gdp: latest.gdp,
          gdp_target: 5.0,
          cpi: latest.cpi,
          ppi: latest.ppi,
          pmi: latest.pmi,
          m2: latest.m2,
          social_financing: latest.social_financing,
          rate_10y: latest.bond_10y,
          rate_1y_lpr: latest.rate_1y_lpr,
          rate_5y_lpr: latest.rate_5y_lpr,
          reserve_ratio: latest.reserve_ratio
        };

      case 'portfolio':
        return {
          total_aum: latest.total_aum,
          allocation: latest.allocation,
          holdings: latest.holdings,
          duration_asset: latest.duration_asset,
          duration_liability: latest.duration_liability,
          duration_gap: latest.duration_gap,
          yield_portfolio: latest.yield_portfolio,
          cost_liability: latest.cost_liability,
          spread: latest.spread,
          liquidity_ratio: latest.liquidity_ratio,
          single_concentration: latest.single_concentration,
          overseas_ratio: latest.overseas_ratio,
          real_estate_ratio: latest.real_estate_ratio
        };

      case 'all':
      default:
        return latest;
    }
  }

  /**
   * 获取特定日期的数据
   */
  function getByDate(dateStr) {
    const history = getHistory(60);
    return history.find(d => d.date === dateStr) || null;
  }

  /**
   * 重置缓存（强制重新生成）
   */
  function resetCache() {
    cachedHistory = null;
  }

  // ============ 导出 ============
  return {
    generateOneDay: generateOneDay,
    generateHistory: generateHistory,
    getHistory: getHistory,
    getLatest: getLatest,
    getByDate: getByDate,
    resetCache: resetCache,
    getBaseline: () => BASELINE,
    getFundsBaseline: () => FUNDS_BASELINE
  };
})();

if (typeof window !== 'undefined') {
  window.MockDataGenerator = MockDataGenerator;
}
