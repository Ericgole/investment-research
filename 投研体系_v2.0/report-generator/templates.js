/**
 * Report Templates - 报告模板引擎
 * 日报 + 周报两种模板，数据驱动渲染
 * @version 1.0.0
 */

const ReportTemplates = (function() {
  'use strict';

  const templates = {
    daily: {
      name: '投资日报',
      frequency: 'daily',
      sections: [
        { id: 'header',        title: '报告头',       type: 'fixed' },
        { id: 'market_overview',   title: '市场概览',     type: 'data' },
        { id: 'portfolio_summary', title: '组合概况',     type: 'data' },
        { id: 'saa_status',    title: 'SAA配置状态',   type: 'data' },
        { id: 'risk_metrics',  title: '风险指标',      type: 'data' },
        { id: 'alerts_summary',title: '预警摘要',      type: 'data' },
        { id: 'manager_comment',title: '投资经理点评',   type: 'textarea' },
        { id: 'appendix',      title: '附录',          type: 'fixed' }
      ]
    },
    weekly: {
      name: '投资周报',
      frequency: 'weekly',
      sections: [
        { id: 'header',             title: '报告头',           type: 'fixed' },
        { id: 'market_review',      title: '本周市场回顾',      type: 'data' },
        { id: 'performance_analysis',title: '绩效分析',         type: 'data' },
        { id: 'saa_review',         title: 'SAA回顾与调整',     type: 'data' },
        { id: 'risk_review',        title: '风险回顾',         type: 'data' },
        { id: 'alerts_statistics',  title: '预警统计',         type: 'data' },
        { id: 'next_week_plan',     title: '下周计划',         type: 'textarea' },
        { id: 'appendix',           title: '附录',             type: 'fixed' }
      ]
    },
    merged: {
      name: '合并版晨报',
      frequency: 'daily',
      sections: [
        // === 上半部分：研究视角 ===
        { id: 'merged_header',        title: '晨报头',            type: 'fixed' },
        { id: 'merged_macro',         title: '宏观速览',          type: 'data' },
        { id: 'merged_industry',      title: '行业景气',          type: 'data' },
        { id: 'merged_sentiment',     title: '市场情绪',          type: 'data' },
        { id: 'merged_signals',       title: '策略信号',          type: 'data' },
        // === 下半部分：投资视角 ===
        { id: 'merged_portfolio',     title: '组合概况',          type: 'data' },
        { id: 'merged_holdings',      title: '持仓动态',          type: 'data' },
        { id: 'merged_saa',           title: 'SAA配置',           type: 'data' },
        { id: 'merged_risk',          title: '风险指标',          type: 'data' },
        { id: 'merged_alerts',        title: '预警摘要',          type: 'data' },
        { id: 'merged_news',          title: '宏观要闻',          type: 'data' },
        { id: 'merged_quote',         title: '投资大师名言',       type: 'fixed' },
        { id: 'merged_focus',         title: '今日关注',          type: 'data' },
        { id: 'merged_appendix',      title: '附录',              type: 'fixed' }
      ]
    }
  };

  // ============ Section 渲染函数 ============

  function renderHeader(data) {
    var now = new Date();
    var typeName = data.type === 'weekly' ? '周报' : '日报';
    return '<div class="report-header">' +
      '<h1>建信人寿资产管理部</h1>' +
      '<h2>投资' + typeName + '</h2>' +
      '<p>报告日期：' + (data.date || now.toLocaleDateString('zh-CN')) + '</p>' +
      '<p>报告人：NOMI智能投研系统 · 自动生成</p>' +
      '</div>';
  }

  function renderMarketOverview(data) {
    var macro = data.macro || {};
    var r = '<h3>一、市场概览</h3><table class="rpt-table">' +
      '<tr><th>指标</th><th>当前值</th><th>说明</th></tr>' +
      '<tr><td>上证指数</td><td>' + (macro.stock_index || 3280) + '</td><td>日内趋势</td></tr>' +
      '<tr><td>10年期国债收益率</td><td>' + (macro.bond_10y || macro.rate_10y || '1.72') + '%</td><td>基准利率</td></tr>' +
      '<tr><td>GDP增长率</td><td>' + (macro.gdp || 5.2) + '%</td><td>季度数据</td></tr>' +
      '<tr><td>CPI同比</td><td>' + (macro.cpi || 2.1) + '%</td><td>月度数据</td></tr>' +
      '<tr><td>PMI</td><td>' + (macro.pmi || 49.5) + '</td><td>制造业景气度</td></tr>' +
      '<tr><td>美元/人民币</td><td>' + (macro.cny_usd || 7.25) + '</td><td>汇率</td></tr>' +
      '</table>';
    return r;
  }

  function renderPortfolioSummary(data) {
    var p = data.portfolio || {};
    return '<h3>二、组合概况</h3><table class="rpt-table">' +
      '<tr><th>指标</th><th>当前值</th></tr>' +
      '<tr><td>总管理规模(AUM)</td><td>' + (p.total_aum ? (p.total_aum / 1e8).toFixed(1) + '亿' : '50.0亿') + '</td></tr>' +
      '<tr><td>综合投资收益率</td><td>' + ((data.portfolio_return || data.yield_portfolio || 4.20)) + '%</td></tr>' +
      '<tr><td>负债成本</td><td>' + ((data.cost_liability || 3.50)) + '%</td></tr>' +
      '<tr><td>利差</td><td>+' + ((data.spread_value || 70)) + 'bp</td></tr>' +
      '<tr><td>持仓基金数</td><td>' + ((data.holdings || 7) + '只') + '</td></tr>' +
      '</table>';
  }

  function renderSAAStatus(data) {
    var saa = data.saa || {};
    var alloc = saa.allocation || { equity: 0.18, bond: 0.65, alternative: 0.12, cash: 0.05 };
    return '<h3>三、SAA配置状态</h3><table class="rpt-table">' +
      '<tr><th>资产类别</th><th>当前配置</th><th>上限</th><th>状态</th></tr>' +
      '<tr><td>权益类</td><td>' + Math.round(alloc.equity * 100) + '%</td><td>45%</td><td style="color:#10b981">合规</td></tr>' +
      '<tr><td>固收类</td><td>' + Math.round(alloc.bond * 100) + '%</td><td>-</td><td>-</td></tr>' +
      '<tr><td>另类投资</td><td>' + Math.round(alloc.alternative * 100) + '%</td><td>30%</td><td style="color:#10b981">合规</td></tr>' +
      '<tr><td>流动性</td><td>' + Math.round(alloc.cash * 100) + '%</td><td>≥5%</td><td style="color:#f59e0b">临界</td></tr>' +
      '</table>';
  }

  function renderRiskMetrics(data) {
    var risk = data.risk || {};
    var solvency = data.solvency || data.solvency_ratio || 132;
    var dur = data.duration || data.duration_gap || 2.1;
    return '<h3>四、风险指标</h3><table class="rpt-table">' +
      '<tr><th>指标</th><th>当前值</th><th>预警阈值</th><th>状态</th></tr>' +
      '<tr><td>偿付能力充足率</td><td>' + (typeof solvency === 'object' ? solvency.comprehensive_ratio : solvency) + '%</td><td>≥120%</td><td style="color:#10b981">达标</td></tr>' +
      '<tr><td>久期缺口</td><td>+' + (typeof dur === 'object' ? dur.gap : dur) + '年</td><td>±1.5年</td><td style="color:#f59e0b">关注</td></tr>' +
      '<tr><td>流动性比率</td><td>' + ((risk.liquidity_ratio || 0.05) * 100).toFixed(0) + '%</td><td>≥5%</td><td style="color:#f59e0b">临界</td></tr>' +
      '<tr><td>95%VaR</td><td>' + ((risk.var_95 || -1.2) * 100).toFixed(1) + '%</td><td>-</td><td>-</td></tr>' +
      '</table>';
  }

  function renderAlertsSummary(data) {
    var alerts = data.alerts || [];
    if (alerts.length === 0) {
      return '<h3>五、预警摘要</h3><p style="color:#10b981">今日无预警，系统运行正常。</p>';
    }
    var critical = alerts.filter(function(a) { return a.severity === 'critical'; });
    var warning = alerts.filter(function(a) { return a.severity === 'warning'; });
    var r = '<h3>五、预警摘要</h3>' +
      '<p>今日共触发了 ' + alerts.length + ' 条预警：<span style="color:#ef4444">严重 ' + critical.length + '</span>、<span style="color:#f59e0b">关注 ' + warning.length + '</span></p>' +
      '<table class="rpt-table"><tr><th>级别</th><th>预警名称</th><th>消息</th></tr>';
    alerts.forEach(function(a) {
      r += '<tr><td>' + (a.severity === 'critical' ? '🔴 严重' : a.severity === 'warning' ? '🟡 关注' : '🔵 提醒') +
        '</td><td>' + a.name + '</td><td>' + a.message + '</td></tr>';
    });
    r += '</table>';
    return r;
  }

  function renderManagerComment(data) {
    return '<h3>六、投资经理点评</h3>' +
      '<div class="comment-area" contenteditable="true" placeholder="请输入投资经理点评...">' +
      (data.comment || data.manager_comment || '') +
      '</div>';
  }

  function renderAppendix(data) {
    return '<h3>附录</h3>' +
      '<p style="color:#94a3b8;font-size:11px">' +
      '免责声明：本报告由NOMI智能投研系统自动生成，仅供内部参考，不构成任何投资建议。<br>' +
      '数据来源：Wind金融终端、SQLite本地数据库、Mock Data Generator。<br>' +
      '报告生成时间：' + new Date().toLocaleString('zh-CN') + '<br>' +
      '数据管线版本：etl-core v1.0 | 预警引擎：alert-engine v1.0' +
      '</p>';
  }

  // 周报特有 section
  function renderMarketReview(data) {
    var macro = data.macro || {};
    var r = '<h3>一、本周市场回顾</h3><table class="rpt-table">' +
      '<tr><th>指标</th><th>周初</th><th>周末</th><th>变化</th></tr>' +
      '<tr><td>上证指数</td><td>' + ((macro.stock_index || 3280) - 30) + '</td><td>' + (macro.stock_index || 3280) + '</td><td style="color:#10b981">+30</td></tr>' +
      '<tr><td>10Y国债</td><td>' + ((parseFloat(macro.bond_10y) || 1.72) - 0.04).toFixed(2) + '%</td><td>' + (macro.bond_10y || 1.72) + '%</td><td style="color:#10b981">+' + (0.04).toFixed(0) + 'bp</td></tr>' +
      '<tr><td>PMI</td><td>49.3</td><td>' + (macro.pmi || 49.5) + '</td><td style="color:#10b981">+0.2</td></tr>' +
      '</table>' +
      '<p style="margin-top:12px;color:#64748b">本周市场整体平稳，权益市场小幅上行，债券收益率温和上涨。</p>';
    return r;
  }

  function renderPerformanceAnalysis(data) {
    return '<h3>二、绩效分析</h3><table class="rpt-table">' +
      '<tr><th>指标</th><th>本周</th><th>本月</th><th>本年</th></tr>' +
      '<tr><td>组合收益率</td><td style="color:#10b981">+0.15%</td><td>+0.42%</td><td>+1.40%</td></tr>' +
      '<tr><td>基准收益率</td><td>+0.10%</td><td>+0.35%</td><td>+1.20%</td></tr>' +
      '<tr><td>超额收益</td><td style="color:#10b981">+0.05%</td><td style="color:#10b981">+0.07%</td><td style="color:#10b981">+0.20%</td></tr>' +
      '<tr><td>夏普比率</td><td>0.85</td><td>0.82</td><td>0.78</td></tr>' +
      '</table>';
  }

  function renderNextWeekPlan(data) {
    return '<h3>六、下周计划</h3>' +
      '<div class="comment-area" contenteditable="true" placeholder="请输入下周计划...">' +
      (data.next_plan || data.next_week_plan || '') +
      '</div>';
  }

  // ============ 合并版晨报 Section 渲染 ============

  function renderMergedHeader(data) {
    var now = new Date();
    return '<div class="merged-report-header">' +
      '<div class="merged-header-left">' +
        '<h1>建信人寿资产管理部</h1>' +
        '<h2>合并版晨报</h2>' +
        '<p>报告日期：' + (data.date || now.toLocaleDateString('zh-CN')) + '</p>' +
      '</div>' +
      '<div class="merged-header-right">' +
        '<div class="merged-header-badge research">研究视角</div>' +
        '<div class="merged-header-badge invest">投资视角</div>' +
        '<p style="font-size:10px;color:#94a3b8;margin-top:4px">NOMI智能投研系统 · 自动生成</p>' +
      '</div>' +
      '</div>';
  }

  function renderMergedMacro(data) {
    var macro = data.research ? (data.research.macro || {}) : {};
    var score = macro.macro_score || {};
    var indicators = macro.indicators || [];
    var html = '<h3>一、宏观速览 ' +
      '<span class="macro-score ' + (score.signal || 'neutral') + '">综合评分：' + (score.score || 50) + '（' + (score.label || '中性') + '）</span>' +
      '</h3>' +
      '<table class="rpt-table"><tr><th>指标</th><th>当前值</th><th>趋势</th><th>预期</th><th>来源</th></tr>';

    if (indicators.length === 0) {
      // 降级：使用基础数据
      var m = data.macro || {};
      html += '<tr><td>GDP同比</td><td>' + (m.gdp || '5.0') + '%</td><td>稳定 →</td><td>' + (m.gdp || '5.0') + '%</td><td>国家统计局</td></tr>' +
        '<tr><td>CPI同比</td><td>' + (m.cpi || '0.2') + '%</td><td>上行 ↑</td><td>' + (parseFloat(m.cpi || 0.2) + 0.1).toFixed(1) + '%</td><td>国家统计局</td></tr>' +
        '<tr><td>制造业PMI</td><td>' + (m.pmi_manufacturing || (m.pmi || '49.5')) + '</td><td>下行 ↓</td><td>' + (parseFloat(m.pmi_manufacturing || (m.pmi || 49.5)) - 0.2).toFixed(1) + '</td><td>中采/统计局</td></tr>' +
        '<tr><td>10Y国债收益率</td><td>' + (m.bond_yield_10y || (m.bond_10y || '2.72')) + '%</td><td>下行 ↓</td><td>' + (parseFloat(m.bond_yield_10y || (m.bond_10y || 2.72)) - 0.05).toFixed(2) + '%</td><td>中国货币网</td></tr>' +
        '<tr><td>社融增量</td><td>' + (m.social_financing || '3.8') + '万亿</td><td>上行 ↑</td><td>' + (parseFloat(m.social_financing || 3.8) + 0.2).toFixed(1) + '万亿</td><td>央行</td></tr>' +
        '<tr><td>USD/CNY</td><td>' + (m.usd_cny || '7.18') + '</td><td>稳定 →</td><td>' + (m.usd_cny || '7.18') + '</td><td>中国外汇交易中心</td></tr>';
    } else {
      indicators.forEach(function(ind) {
        html += '<tr><td>' + ind.name + '</td><td>' + ind.value + ind.unit + '</td>' +
          '<td class="' + (ind.trend_class || '') + '">' + (ind.trend_label || '稳定 →') + '</td>' +
          '<td>' + (ind.expected || '—') + ind.unit + '</td>' +
          '<td>' + (ind.source || '—') + '</td></tr>';
      });
    }
    html += '</table>';

    // 宏观判断
    html += '<div class="rpt-insight"><strong>宏观判断：</strong>' +
      '经济弱复苏阶段，低通胀(CPI 0.2%)为宽松提供空间，但制造业PMI仍在荣枯线以下。' +
      '10Y国债收益率下行至2.72%，反映市场对宽松预期升温。北向资金回归，情绪回暖。' +
      '</div>';

    return html;
  }

  function renderMergedIndustry(data) {
    var industry = data.research ? (data.research.industry || {}) : {};
    var composite = industry.composite || {};
    var ranking = industry.ranking || [];
    var html = '<h3>二、行业景气 <span class="industry-composite">综合景气度：' +
      (composite.score || 50) + '（' + (composite.label || '中性') + '）</span></h3>' +
      '<table class="rpt-table"><tr><th>行业</th><th>景气度</th><th>趋势</th><th>主题</th><th>核心驱动</th></tr>';

    if (ranking.length === 0) {
      ranking = [
        { name: '半导体', score: 74, trend_label: '上升 ↑', theme: '国产替代+AI算力', drivers: [{name:'AI芯片需求',score:82}] },
        { name: '高端制造', score: 71, trend_label: '上升 ↑', theme: '工业母机+机器人', drivers: [{name:'人形机器人进展',score:82}] },
        { name: '新能源', score: 70, trend_label: '平稳 →', theme: '储能+电动车', drivers: [{name:'储能装机增速',score:85}] },
        { name: '医药', score: 66, trend_label: '上升 ↑', theme: '创新药+老龄化', drivers: [{name:'老龄化需求',score:80}] },
        { name: '大消费', score: 58, trend_label: '下降 ↓', theme: '消费复苏+国货崛起', drivers: [{name:'线上渗透率',score:78}] },
        { name: '金融地产', score: 50, trend_label: '下降 ↓', theme: '银行息差+地产纾困', drivers: [{name:'保险保费收入',score:72}] }
      ];
    }

    ranking.forEach(function(ind) {
      var topDriver = (ind.drivers && ind.drivers.length > 0) ? ind.drivers[0].name : '—';
      var trendClass = ind.trend_class || '';
      html += '<tr>' +
        '<td><strong>' + ind.name + '</strong></td>' +
        '<td><span style="display:inline-block;width:40px;height:6px;background:#e2e8f0;border-radius:3px;vertical-align:middle;margin-right:6px">' +
        '<span style="display:inline-block;width:' + (ind.score) + '%;height:6px;background:' + (ind.color || '#2563eb') + ';border-radius:3px"></span></span>' +
        ind.score + '</td>' +
        '<td class="' + trendClass + '">' + (ind.trend_label || '平稳 →') + '</td>' +
        '<td style="font-size:11px;color:#64748b">' + (ind.theme || '—') + '</td>' +
        '<td style="font-size:11px;color:#64748b">' + topDriver + '</td>' +
        '</tr>';
    });
    html += '</table>';

    html += '<div class="rpt-insight"><strong>行业判断：</strong>' +
      '半导体(74分)和高端制造(71分)领跑，受国产替代政策和AI算力需求双轮驱动。' +
      '大消费(58分)和金融地产(50分)偏弱，消费信心不足和地产纾困尚未见效是主要拖累。' +
      '</div>';

    return html;
  }

  function renderMergedSentiment(data) {
    var sentiment = data.research ? (data.research.sentiment || {}) : {};
    var score = sentiment.score || {};
    var indicators = sentiment.indicators || [];
    var flow = sentiment.flow || {};

    var html = '<h3>三、市场情绪 <span class="sentiment-score ' + (score.signal || 'neutral') + '">综合情绪：' +
      (score.score || 50) + '（' + (score.label || '中性') + '）</span></h3>';

    // 资金流向摘要
    html += '<div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap">' +
      '<div class="flow-card" style="flex:1;min-width:140px;padding:10px;background:#f8fafc;border-radius:8px;text-align:center">' +
      '<div style="font-size:10px;color:#64748b">北向资金</div>' +
      '<div style="font-size:20px;font-weight:700;color:' + ((flow.north && flow.north.value > 0) ? '#ef4444' : '#10b981') + '">' +
      (flow.north ? (flow.north.value > 0 ? '+' : '') + flow.north.value + '亿' : '+18.5亿') + '</div></div>' +
      '<div class="flow-card" style="flex:1;min-width:140px;padding:10px;background:#f8fafc;border-radius:8px;text-align:center">' +
      '<div style="font-size:10px;color:#64748b">南向资金</div>' +
      '<div style="font-size:20px;font-weight:700;color:#10b981">' +
      (flow.south ? '+' + flow.south.value + '亿' : '+22.3亿') + '</div></div>' +
      '<div class="flow-card" style="flex:1;min-width:140px;padding:10px;background:#f8fafc;border-radius:8px;text-align:center">' +
      '<div style="font-size:10px;color:#64748b">两融余额</div>' +
      '<div style="font-size:20px;font-weight:700;color:#1e293b">' +
      (flow.margin_balance ? flow.margin_balance.value + '万亿' : '1.62万亿') + '</div></div>' +
      '</div>';

    // 详细指标表
    html += '<table class="rpt-table"><tr><th>指标</th><th>当前值</th><th>变化</th><th>信号</th><th>来源</th></tr>';

    if (indicators.length === 0) {
      indicators = [
        { name: 'A股情绪指数', value: 52, change_label: '+4.0', sentiment_label: '中性 ☁', source: 'Wind' },
        { name: '港股情绪指数', value: 55, change_label: '+5.0', sentiment_label: '中性 ☁', source: 'Wind' },
        { name: '中国波指(iVIX)', value: 22.5, change_label: '-1.6', sentiment_label: '中性 ☁', source: '上交所' },
        { name: '股权风险溢价(ERP)', value: '3.8%', change_label: '+0.3%', sentiment_label: '中性 ☁', source: 'Wind' }
      ];
    }

    indicators.forEach(function(ind) {
      html += '<tr><td>' + ind.name + '</td><td>' + ind.value + (ind.unit || '') + '</td>' +
        '<td style="color:' + (String(ind.change_label || '').charAt(0) === '+' ? '#ef4444' : '#10b981') + '">' + (ind.change_label || '—') + '</td>' +
        '<td class="' + (ind.sentiment_class || '') + '">' + (ind.sentiment_label || '—') + '</td>' +
        '<td>' + (ind.source || '—') + '</td></tr>';
    });
    html += '</table>';

    html += '<div class="rpt-insight"><strong>情绪判断：</strong>' +
      '市场情绪整体中性偏暖，北向资金转为净流入，两融余额温和上行。' +
      'VIX回落至22.5反映恐慌情绪缓解，ERP 3.8%处于历史中位，股债比价偏股。' +
      '</div>';

    return html;
  }

  function renderMergedSignals(data) {
    var taa = data.taa || {};
    var html = '<h3>四、策略信号 —— 大类资产配置建议</h3>';

    // TAA 五维评分卡
    html += '<table class="rpt-table"><tr><th colspan="4" style="text-align:center;background:#0F4C81;color:#fff">TAA 五维评分卡（加权总分：' +
      (taa.total_score || '+0.85') + '）</th></tr>' +
      '<tr><th>维度</th><th>权重</th><th>评分</th><th>理由</th></tr>';

    var dimensions = taa.dimensions || [
      { name: '宏观', weight: '30%', score: '+0.5', reason: '低利率+弱美元+政策托底' },
      { name: '估值', weight: '30%', score: '-0.5', reason: 'PE 5Y分位87%偏贵，沪深300 14.4x' },
      { name: '政策', weight: '20%', score: '+2.5', reason: '大基金三期+科创再贷款+AI政策极强' },
      { name: '资金', weight: '15%', score: '+1.0', reason: '公募超配科技+19.3%，北向回流转正' },
      { name: '技术', weight: '5%', score: '-1.0', reason: '均线空头排列，MACD底背离待确认' }
    ];

    dimensions.forEach(function(d) {
      var color = parseFloat(d.score) > 0 ? '#ef4444' : parseFloat(d.score) < 0 ? '#10b981' : '#64748b';
      html += '<tr><td>' + d.name + '</td><td>' + d.weight + '</td>' +
        '<td style="color:' + color + ';font-weight:700">' + d.score + '</td>' +
        '<td style="font-size:11px;color:#64748b">' + d.reason + '</td></tr>';
    });
    html += '</table>';

    // 资产配置建议
    html += '<table class="rpt-table" style="margin-top:12px"><tr><th colspan="5" style="text-align:center;background:#0F4C81;color:#fff">大类资产配置建议</th></tr>' +
      '<tr><th>资产类别</th><th>建议方向</th><th>SAA中枢</th><th>当前</th><th>操作建议</th></tr>';

    var allocation = data.allocation || { equity: 0.18, bond: 0.65, alternative: 0.12, cash: 0.05 };
    html += '<tr><td>固收类</td><td style="color:#10b981">维持</td><td>65%</td><td>' + Math.round(allocation.bond * 100) + '%</td><td>持有到期，关注信用利差</td></tr>' +
      '<tr><td>权益类</td><td style="color:#f59e0b">谨慎</td><td>18%</td><td>' + Math.round(allocation.equity * 100) + '%</td><td>逢低布局，控制仓位</td></tr>' +
      '<tr><td>另类投资</td><td style="color:#10b981">维持</td><td>12%</td><td>' + Math.round(allocation.alternative * 100) + '%</td><td>黄金+REITs分散</td></tr>' +
      '<tr><td>流动性</td><td style="color:#10b981">维持</td><td>5%</td><td>' + Math.round(allocation.cash * 100) + '%</td><td>保持充足流动性</td></tr>' +
      '</table>';

    html += '<div class="rpt-insight"><strong>策略总结：</strong>' +
      'TAA总分 +0.85，维持SAA配置中枢不变。政策维度(+2.5)是最强驱动，估值(-0.5)和技术(-1.0)构成制约。' +
      '建议：标普500(23%)+信用债(27%)+黄金(21%)为核心底仓，创业板(9%)作为A股成长弹性敞口。' +
      '</div>';

    return html;
  }

  function renderMergedPortfolio(data) {
    var p = data.portfolio || {};
    return '<div class="rpt-divider"><span>投资视角</span></div>' +
      '<h3>五、组合概况</h3><table class="rpt-table">' +
      '<tr><th>指标</th><th>当前值</th><th>说明</th></tr>' +
      '<tr><td>总管理规模(AUM)</td><td><strong>' + (p.total_aum ? (p.total_aum / 1e8).toFixed(1) + '亿' : '50.0亿') + '</strong></td><td>含QDII+港股通</td></tr>' +
      '<tr><td>综合投资收益率</td><td style="color:#ef4444;font-weight:700">' + ((data.portfolio_return || data.yield_portfolio || 4.20)) + '%</td><td>年化</td></tr>' +
      '<tr><td>负债成本</td><td>' + ((data.cost_liability || 3.50)) + '%</td><td>预定利率均值</td></tr>' +
      '<tr><td>利差</td><td style="color:' + ((data.spread_value || 70) > 0 ? '#10b981' : '#ef4444') + ';font-weight:700">+' + ((data.spread_value || 70)) + 'bp</td><td>收益-负债成本</td></tr>' +
      '<tr><td>持仓基金数</td><td>' + ((data.holdings || 7) + '只') + '</td><td>主动+被动</td></tr>' +
      '<tr><td>YTD收益</td><td style="color:#ef4444;font-weight:700">+' + ((p.ytd_return || 1.40)) + '%</td><td>vs 基准 +1.20%</td></tr>' +
      '</table>';
  }

  function renderMergedHoldings(data) {
    var funds = data.fund_holdings || [
      { code: '510300', name: '沪深300ETF', nav: 4.125, weight: 12, change: 0.8 },
      { code: '510500', name: '中证500ETF', nav: 6.830, weight: 6, change: 1.2 },
      { code: '511260', name: '10年国债ETF', nav: 102.45, weight: 35, change: -0.1 },
      { code: '511010', name: '5年国债ETF', nav: 101.20, weight: 20, change: -0.05 },
      { code: '518880', name: '黄金ETF', nav: 5.68, weight: 10, change: 0.3 },
      { code: '513100', name: '纳指ETF', nav: 2.45, weight: 10, change: 1.5 },
      { code: '511270', name: '信用债ETF', nav: 100.89, weight: 7, change: 0.05 }
    ];

    var html = '<h3>六、持仓动态</h3><table class="rpt-table">' +
      '<tr><th>代码</th><th>名称</th><th>净值</th><th>权重</th><th>日变动</th></tr>';

    funds.forEach(function(f) {
      var changeColor = f.change >= 0 ? '#ef4444' : '#10b981';
      var changeSign = f.change >= 0 ? '+' : '';
      html += '<tr>' +
        '<td>' + f.code + '</td>' +
        '<td><strong>' + f.name + '</strong></td>' +
        '<td>' + f.nav.toFixed(2) + '</td>' +
        '<td>' + f.weight + '%</td>' +
        '<td style="color:' + changeColor + ';font-weight:600">' + changeSign + f.change + '%</td>' +
        '</tr>';
    });
    html += '</table>';

    // 今日变动最大的标的
    var sorted = funds.slice().sort(function(a, b) { return Math.abs(b.change) - Math.abs(a.change); });
    html += '<div class="rpt-insight"><strong>持仓异动：</strong>' +
      sorted[0].name + '（' + sorted[0].code + '）今日变动最大' +
      (sorted[0].change >= 0 ? '，上涨' : '，下跌') + Math.abs(sorted[0].change) + '%。' +
      '纳指ETF领涨(+1.5%)，受隔夜美股科技股反弹带动。国债ETF微跌，长端利率小幅上行。' +
      '</div>';

    return html;
  }

  function renderMergedSAA(data) {
    var saa = data.saa || {};
    var alloc = saa.allocation || { equity: 0.18, bond: 0.65, alternative: 0.12, cash: 0.05 };

    var html = '<h3>七、SAA战略配置</h3><table class="rpt-table">' +
      '<tr><th>资产类别</th><th>SAA中枢</th><th>当前配置</th><th>偏离</th><th>上限</th><th>状态</th></tr>' +
      '<tr><td>固收类</td><td>65%</td><td>' + Math.round(alloc.bond * 100) + '%</td><td>' +
      (Math.round(alloc.bond * 100) - 65 > 0 ? '+' : '') + (Math.round(alloc.bond * 100) - 65) + '%</td><td>—</td><td style="color:#10b981">✓</td></tr>' +
      '<tr><td>权益类</td><td>18%</td><td>' + Math.round(alloc.equity * 100) + '%</td><td>' +
      (Math.round(alloc.equity * 100) - 18 > 0 ? '+' : '') + (Math.round(alloc.equity * 100) - 18) + '%</td><td>45%</td><td style="color:#10b981">合规</td></tr>' +
      '<tr><td>另类投资</td><td>12%</td><td>' + Math.round(alloc.alternative * 100) + '%</td><td>0%</td><td>30%</td><td style="color:#10b981">合规</td></tr>' +
      '<tr><td>流动性</td><td>5%</td><td>' + Math.round(alloc.cash * 100) + '%</td><td>0%</td><td>≥5%</td><td style="color:#f59e0b">临界</td></tr>' +
      '</table>';

    html += '<div class="rpt-insight"><strong>配置判断：</strong>' +
      '当前配置与SAA中枢偏离在±3%以内，未触发再平衡条件。' +
      '流动性占比处于临界值，建议关注是否有调仓带来的流动性压力。' +
      '</div>';

    return html;
  }

  function renderMergedRisk(data) {
    var risk = data.risk || {};
    var solvency = data.solvency || data.solvency_ratio || 132;
    var dur = data.duration || data.duration_gap || 2.1;

    return '<h3>八、风险指标</h3><table class="rpt-table">' +
      '<tr><th>指标</th><th>当前值</th><th>预警阈值</th><th>限额</th><th>状态</th></tr>' +
      '<tr><td>偿付能力充足率</td><td><strong>' + (typeof solvency === 'object' ? solvency.comprehensive_ratio : solvency) + '%</strong></td><td>120%</td><td>≥100%</td><td style="color:#10b981">达标 ✓</td></tr>' +
      '<tr><td>久期缺口</td><td><strong>+' + (typeof dur === 'object' ? dur.gap : dur) + '年</strong></td><td>±1.5年</td><td>±3年</td><td style="color:#f59e0b">关注 ⚠</td></tr>' +
      '<tr><td>VaR(99%,10日)</td><td><strong>-4.82%</strong></td><td>—</td><td>≤8%</td><td style="color:#10b981">合规 ✓</td></tr>' +
      '<tr><td>最大回撤</td><td><strong>-8.5%</strong></td><td>—</td><td>≤30%</td><td style="color:#10b981">合规 ✓</td></tr>' +
      '<tr><td>流动性比率</td><td><strong>' + ((risk.liquidity_ratio || 0.05) * 100).toFixed(0) + '%</strong></td><td>—</td><td>≥5%</td><td style="color:#f59e0b">临界 ⚠</td></tr>' +
      '<tr><td>外汇敞口(QDII)</td><td><strong>23%</strong></td><td>—</td><td>≤20%</td><td style="color:#ef4444">超标 ✗</td></tr>' +
      '</table>';
  }

  function renderMergedAlerts(data) {
    var alerts = data.alerts || [];
    var html = '<h3>九、预警摘要</h3>';

    if (alerts.length === 0) {
      html += '<p style="color:#10b981">✅ 今日0条预警，系统运行正常。</p>';
    } else {
      var critical = alerts.filter(function(a) { return a.severity === 'critical'; });
      var warning = alerts.filter(function(a) { return a.severity === 'warning'; });
      html += '<p>今日触发了 <strong>' + alerts.length + '</strong> 条预警：' +
        '<span style="color:#ef4444">严重 ' + critical.length + '</span>、' +
        '<span style="color:#f59e0b">关注 ' + warning.length + '</span></p>' +
        '<table class="rpt-table"><tr><th>级别</th><th>预警名称</th><th>消息</th><th>建议操作</th></tr>';
      alerts.forEach(function(a) {
        html += '<tr><td>' + (a.severity === 'critical' ? '🔴 严重' : a.severity === 'warning' ? '🟡 关注' : '🔵 提醒') +
          '</td><td>' + a.name + '</td><td>' + a.message + '</td><td>' + (a.action || '—') + '</td></tr>';
      });
      html += '</table>';
    }

    // 关键监控项状态
    html += '<div style="margin-top:12px;padding:10px;background:#f8fafc;border-radius:8px;font-size:11px">' +
      '<strong>监控项状态：</strong>' +
      '🔴 外汇敞口超标(23%>20%) | ' +
      '🟡 久期缺口(+2.1年>±1.5) | ' +
      '🟡 流动性临界(5%) | ' +
      '🟢 偿付能力、VaR、回撤均合规' +
      '</div>';

    return html;
  }

  function renderMergedNews(data) {
    var news = data.news || data.macro_news || [];
    var html = '<h3>十、宏观要闻</h3><table class="rpt-table"><tr><th>时间</th><th>类别</th><th>要闻</th><th>影响</th></tr>';

    var defaultNews = [
      { time: '今日', category: '货币政策', content: '央行维持7天逆回购利率1.50%不变，连续第3个月按兵不动', impact: '中性' },
      { time: '今日', category: '国际', content: '美联储7月会议纪要显示9月降息概率升至85%', impact: '偏多(A股/黄金)' },
      { time: '昨日', category: '产业政策', content: '大基金三期首批3440亿资金到位，重点投向半导体设备和材料', impact: '利好半导体' },
      { time: '昨日', category: '宏观数据', content: '7月社融增量3.8万亿，高于预期3.5万亿，M2增速9.5%', impact: '偏多' },
      { time: '本周', category: '保险监管', content: '金融监管总局发布新偿付能力监管规则征求意见稿', impact: '关注' }
    ];

    var items = news.length > 0 ? news : defaultNews;
    items.forEach(function(n) {
      var impactColor = n.impact.indexOf('利多') >= 0 || n.impact.indexOf('偏多') >= 0 || n.impact.indexOf('利好') >= 0 ? '#ef4444' :
                        n.impact.indexOf('利空') >= 0 ? '#10b981' : '#64748b';
      html += '<tr><td>' + n.time + '</td><td>' + n.category + '</td><td>' + n.content + '</td>' +
        '<td style="color:' + impactColor + ';font-weight:600">' + n.impact + '</td></tr>';
    });
    html += '</table>';

    return html;
  }

  function renderMergedQuote(data) {
    var quotes = data.quotes || [
      { text: '投资的第一条规则是不要亏损，第二条规则是记住第一条。', author: '沃伦·巴菲特' },
      { text: '风险来自于你不知道自己在做什么。', author: '沃伦·巴菲特' },
      { text: '在别人贪婪时恐惧，在别人恐惧时贪婪。', author: '沃伦·巴菲特' },
      { text: '市场保持非理性的时间，可能比你保持 solvent 的时间更长。', author: '凯恩斯' },
      { text: '投资是放弃今天的消费，以换取未来更多的消费。', author: '威廉·夏普' }
    ];
    var q = quotes[Math.floor(Math.random() * quotes.length)];

    return '<h3>十一、投资大师名言</h3>' +
      '<blockquote style="margin:0;padding:16px 20px;background:linear-gradient(135deg,#f0f4ff,#e8f0f8);border-left:4px solid #0F4C81;border-radius:0 8px 8px 0;font-style:italic;color:#334155">' +
      '<p style="margin:0 0 8px;font-size:14px">"' + q.text + '"</p>' +
      '<footer style="font-size:11px;color:#64748b;font-style:normal">—— ' + q.author + '</footer>' +
      '</blockquote>';
  }

  function renderMergedFocus(data) {
    var html = '<h3>十二、今日关注</h3>';

    var focusItems = data.focus_items || [
      { priority: 'P0', content: '关注7月CPI数据发布（预期0.3%，前值0.2%），若超预期上行将影响降息预期', action: '盘中关注' },
      { priority: 'P1', content: '大基金三期首批资金到位后半导体板块反应，关注设备龙头中微公司、北方华创', action: '持续跟踪' },
      { priority: 'P1', content: '外汇敞口23%仍超标，需制定QDII仓位调降计划（目标降至20%以下）', action: '本周提交方案' },
      { priority: 'P2', content: '标普500创新高后估值偏高(PE 25x)，评估是否需要部分止盈', action: '周度评估' }
    ];

    html += '<table class="rpt-table"><tr><th>优先级</th><th>关注事项</th><th>行动</th></tr>';
    focusItems.forEach(function(item) {
      var priColor = item.priority === 'P0' ? '#ef4444' : item.priority === 'P1' ? '#f59e0b' : '#3b82f6';
      html += '<tr><td><span style="display:inline-block;padding:2px 8px;border-radius:4px;background:' +
        priColor.replace(')', ',0.1)').replace('rgb', 'rgba') + ';color:' + priColor + ';font-weight:700;font-size:10px">' +
        item.priority + '</span></td><td>' + item.content + '</td><td style="font-size:11px;color:#64748b">' +
        item.action + '</td></tr>';
    });
    html += '</table>';

    return html;
  }

  function renderMergedAppendix(data) {
    return '<h3>附录</h3>' +
      '<p style="color:#94a3b8;font-size:11px;line-height:1.8">' +
      '<strong>免责声明：</strong>本报告由NOMI智能投研系统与WorkBuddy自动生成，仅供内部参考，不构成任何投资建议。<br>' +
      '<strong>数据来源：</strong>Wind金融终端、SQLite本地数据库(research_db.sqlite)、宏观追踪器(MacroTracker v1.0.0)、行业景气度追踪器(IndustryTracker v1.0.0)、市场情绪追踪器(SentimentTracker v1.0.0)。<br>' +
      '<strong>报告生成时间：</strong>' + new Date().toLocaleString('zh-CN') + '<br>' +
      '<strong>数据管线版本：</strong>etl-core v1.0 | 预警引擎：alert-engine v1.0 | 研究模块：market-research v1.0<br>' +
      '<strong>下期报告预计生成：</strong>' + getNextBizDay() + ' 06:30' +
      '</p>';
  }

  function getNextBizDay() {
    var d = new Date();
    d.setDate(d.getDate() + 1);
    var day = d.getDay();
    if (day === 0) d.setDate(d.getDate() + 1); // Sunday → Monday
    else if (day === 6) d.setDate(d.getDate() + 2); // Saturday → Monday
    return d.toLocaleDateString('zh-CN');
  }

  // Section 渲染函数映射
  const sectionRenderers = {
    'header': renderHeader,
    'market_overview': renderMarketOverview,
    'portfolio_summary': renderPortfolioSummary,
    'saa_status': renderSAAStatus,
    'risk_metrics': renderRiskMetrics,
    'alerts_summary': renderAlertsSummary,
    'manager_comment': renderManagerComment,
    'appendix': renderAppendix,
    // 周报
    'market_review': renderMarketReview,
    'performance_analysis': renderPerformanceAnalysis,
    'alerts_statistics': renderAlertsSummary,
    'next_week_plan': renderNextWeekPlan,
    'saa_review': renderSAAStatus,
    'risk_review': renderRiskMetrics,
    // 合并版晨报
    'merged_header': renderMergedHeader,
    'merged_macro': renderMergedMacro,
    'merged_industry': renderMergedIndustry,
    'merged_sentiment': renderMergedSentiment,
    'merged_signals': renderMergedSignals,
    'merged_portfolio': renderMergedPortfolio,
    'merged_holdings': renderMergedHoldings,
    'merged_saa': renderMergedSAA,
    'merged_risk': renderMergedRisk,
    'merged_alerts': renderMergedAlerts,
    'merged_news': renderMergedNews,
    'merged_quote': renderMergedQuote,
    'merged_focus': renderMergedFocus,
    'merged_appendix': renderMergedAppendix
  };

  // ============ 公共 API ============

  function render(templateName, data) {
    var template = templates[templateName];
    if (!template) throw new Error('未知模板: ' + templateName);

    data = data || {};
    data.type = templateName;

    var html = '';
    template.sections.forEach(function(section) {
      var renderer = sectionRenderers[section.id];
      html += '<div class="report-section" id="' + section.id + '">';
      html += renderer ? renderer(data) : '<h3>' + section.title + '</h3><p>暂无数据</p>';
      html += '</div>';
    });

    return html;
  }

  function fillSection(sectionId, data) {
    var renderer = sectionRenderers[sectionId];
    return renderer ? renderer(data) : '';
  }

  function getTemplate(name) {
    return templates[name] || null;
  }

  function getAllTemplates() {
    return Object.keys(templates).map(function(k) {
      return { id: k, name: templates[k].name, sections: templates[k].sections.length };
    });
  }

  return {
    render: render,
    fillSection: fillSection,
    getTemplate: getTemplate,
    getAllTemplates: getAllTemplates,
    templates: templates
  };
})();

if (typeof window !== 'undefined') {
  window.ReportTemplates = ReportTemplates;
}
