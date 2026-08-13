/**
 * Report Aggregator - 报告数据聚合
 * 日报单日数据，周报7日聚合
 * @version 1.0.0
 */

const ReportAggregator = (function() {
  'use strict';

  function getMockFundHoldings() {
    return [
      { code: '510300', name: '沪深300ETF', nav: 4.125, weight: 12, change: 0.8 },
      { code: '510500', name: '中证500ETF', nav: 6.830, weight: 6, change: 1.2 },
      { code: '511260', name: '10年国债ETF', nav: 102.45, weight: 35, change: -0.1 },
      { code: '511010', name: '5年国债ETF', nav: 101.20, weight: 20, change: -0.05 },
      { code: '518880', name: '黄金ETF', nav: 5.68, weight: 10, change: 0.3 },
      { code: '513100', name: '纳指ETF', nav: 2.45, weight: 10, change: 1.5 },
      { code: '511270', name: '信用债ETF', nav: 100.89, weight: 7, change: 0.05 }
    ];
  }

  async function aggregateDaily(dateStr) {
    var data = {};

    // 从 DataPipeline 加载
    try {
      if (window.DataPipeline && DataPipeline.load) {
        var today = dateStr
          ? dateStr.replace(/-/g, '')
          : new Date().toISOString().slice(0, 10).replace(/-/g, '');
        var result = await DataPipeline.load(today);
        data = result.data || result;
      }
    } catch (e) {
      console.warn('[Aggregator] DataPipeline 不可用，使用模拟数据');
    }

    // 从 MockDataGenerator 补齐
    try {
      if (Object.keys(data).length === 0 && window.MockDataGenerator) {
        data = MockDataGenerator.getLatest('all');
      }
    } catch (e) {}

    // 预警数据
    var alerts = [];
    try {
      if (window.AlertHistory) {
        alerts = AlertHistory.getRecent(1);
      }
    } catch (e) {}

    // 构建日报数据
    return {
      date: dateStr || new Date().toISOString().slice(0, 10),
      macro: data.macro_data || data,
      portfolio: {
        total_aum: data.total_aum || 5e9,
        daily_return: 0.15,
        ytd_return: 1.4,
        excess_return: -1.2
      },
      portfolio_return: data.yield_portfolio || 4.20,
      cost_liability: data.cost_liability || 3.50,
      spread_value: (data.spread || 0.70) * 100 || 70,
      holdings: 7,
      saa: {
        allocation: data.allocation || { equity: 0.18, bond: 0.65, alternative: 0.12, cash: 0.05 }
      },
      solvency: data.solvency_ratio || 132,
      risk: {
        solvency_ratio: data.solvency_ratio || 132,
        duration_gap: data.duration_gap || 2.1,
        var_95: -0.012,
        liquidity_ratio: data.liquidity_ratio || 0.05
      },
      duration: data.duration_gap || 2.1,
      alerts: alerts,
      fund_holdings: getMockFundHoldings()
    };
  }

  async function aggregateWeekly(weekEnding) {
    // 单日报数据，标记为周报
    var daily = await aggregateDaily(weekEnding);

    // 尝试聚合7天数据
    var weekData = { macro_avg: {}, risk_trend: [] };
    try {
      if (window.MockDataGenerator) {
        var history = MockDataGenerator.getHistory(7);
        var bondSum = 0, pmiSum = 0, solvencySum = 0;
        history.forEach(function(d) {
          bondSum += parseFloat(d.bond_10y) || 1.72;
          pmiSum += parseFloat(d.pmi) || 49.5;
          solvencySum += parseFloat(d.solvency_ratio) || 132;
          weekData.risk_trend.push({
            date: d.date,
            solvency: d.solvency_ratio,
            gap: d.duration_gap,
            liquidity: d.liquidity_ratio
          });
        });
        var n = history.length || 1;
        weekData.macro_avg = {
          bond_10y: (bondSum / n).toFixed(2),
          pmi: (pmiSum / n).toFixed(1),
          solvency: (solvencySum / n).toFixed(1)
        };
      }
    } catch (e) {}

    return Object.assign(daily, {
      weekly_data: weekData,
      type: 'weekly',
      week_ending: weekEnding || new Date().toISOString().slice(0, 10)
    });
  }

  async function aggregateMerged(dateStr) {
    // 基础投资数据（复用日报）
    var daily = await aggregateDaily(dateStr);

    // 研究视角数据（从市场研究模块加载）
    var research = {};

    try {
      if (typeof MacroTracker !== 'undefined' && MacroTracker.refresh) {
        research.macro = MacroTracker.refresh();
      }
    } catch(e) { console.warn('[Aggregator] MacroTracker 不可用'); }

    try {
      if (typeof IndustryTracker !== 'undefined' && IndustryTracker.refresh) {
        research.industry = IndustryTracker.refresh();
      }
    } catch(e) { console.warn('[Aggregator] IndustryTracker 不可用'); }

    try {
      if (typeof SentimentTracker !== 'undefined' && SentimentTracker.refresh) {
        research.sentiment = SentimentTracker.refresh();
      }
    } catch(e) { console.warn('[Aggregator] SentimentTracker 不可用'); }

    // 尝试通过 DataPipeline 刷新
    try {
      if (typeof ResearchDataBridge !== 'undefined' && ResearchDataBridge.refreshAll) {
        var bridgeData = ResearchDataBridge.refreshAll();
        if (bridgeData) {
          if (bridgeData.macro) research.macro = bridgeData.macro;
          if (bridgeData.industry) research.industry = bridgeData.industry;
          if (bridgeData.sentiment) research.sentiment = bridgeData.sentiment;
        }
      }
    } catch(e) { console.warn('[Aggregator] ResearchDataBridge 不可用'); }

    // TAA 评分卡数据
    var taa = {
      total_score: '+0.85',
      dimensions: [
        { name: '宏观', weight: '30%', score: '+0.5', reason: '低利率+弱美元+政策托底' },
        { name: '估值', weight: '30%', score: '-0.5', reason: 'PE 5Y分位87%偏贵，沪深300 14.4x' },
        { name: '政策', weight: '20%', score: '+2.5', reason: '大基金三期+科创再贷款+AI政策极强' },
        { name: '资金', weight: '15%', score: '+1.0', reason: '公募超配科技+19.3%，北向回流转正' },
        { name: '技术', weight: '5%', score: '-1.0', reason: '均线空头排列，MACD底背离待确认' }
      ]
    };

    return Object.assign(daily, {
      research: research,
      taa: taa,
      type: 'merged'
    });
  }

  return {
    aggregateDaily: aggregateDaily,
    aggregateWeekly: aggregateWeekly,
    aggregateMerged: aggregateMerged
  };
})();

if (typeof window !== 'undefined') {
  window.ReportAggregator = ReportAggregator;
}
