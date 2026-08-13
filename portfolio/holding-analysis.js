/**
 * holding-analysis.js — 持仓分析看板（内部持仓 · 模块三）
 *
 * 职责：资产配置 / 行业分布 / 个券集中度 / 盈亏分布 / 久期分析 / 监管红线
 * 数据：每账户一份模拟持仓；导入数据优先于模拟数据
 */
(function (global) {
  'use strict';

  /* ============================================================
   * 一、账户配置（模拟）
   * ============================================================ */
  const ACCOUNT_CONFIG = {
    '普通': { solvency: 132, duration: { asset: 5.2, liability: 8.5 } },
    '分红': { solvency: 145, duration: { asset: 4.8, liability: 7.9 } },
    '万能': { solvency: 115, duration: { asset: 4.2, liability: 6.8 } },
  };

  /* ============================================================
   * 二、模拟持仓（每账户一份；字段与导入模板兼容，另加 industry）
   * ============================================================ */
  const MOCK_HOLDINGS = {
    '普通': [
      { security_code: '001717.OF', security_name: '工银前沿医疗', asset_class: '权益', industry: '医药', market_value: 1500000, cost_value: 1400000 },
      { security_code: '377240.OF', security_name: '摩根新兴动力', asset_class: '权益', industry: '科技', market_value: 1200000, cost_value: 1250000 },
      { security_code: '005119.OF', security_name: '银华智荟内在价值', asset_class: '权益', industry: '消费', market_value: 800000, cost_value: 750000 },
      { security_code: '159845.OF', security_name: '高端制造ETF', asset_class: '权益', industry: '制造', market_value: 600000, cost_value: 580000 },
      { security_code: '510300.OF', security_name: '金融ETF', asset_class: '权益', industry: '金融', market_value: 400000, cost_value: 420000 },
      { security_code: '511010.OF', security_name: '国债ETF', asset_class: '固收', industry: '利率债', market_value: 2000000, cost_value: 1980000 },
      { security_code: 'B001.CN', security_name: '信用债基金A', asset_class: '固收', industry: '信用债', market_value: 1500000, cost_value: 1490000 },
      { security_code: 'B002.CN', security_name: '城投债组合', asset_class: '固收', industry: '城投', market_value: 1000000, cost_value: 1010000 },
      { security_code: 'B003.CN', security_name: '金融债基金', asset_class: '固收', industry: '金融债', market_value: 500000, cost_value: 500000 },
      { security_code: 'A001.CN', security_name: '基础设施债权计划', asset_class: '另类', industry: '基础设施', market_value: 300000, cost_value: 300000 },
      { security_code: 'C001.CN', security_name: '货币基金', asset_class: '现金', industry: '货币', market_value: 200000, cost_value: 200000 },
    ],
    '分红': [
      { security_code: 'F001.OF', security_name: '消费精选基金', asset_class: '权益', industry: '消费', market_value: 1000000, cost_value: 950000 },
      { security_code: 'F002.OF', security_name: '科技成长基金', asset_class: '权益', industry: '科技', market_value: 900000, cost_value: 950000 },
      { security_code: 'F003.OF', security_name: '医药健康基金', asset_class: '权益', industry: '医药', market_value: 500000, cost_value: 480000 },
      { security_code: 'F004.OF', security_name: '高端制造基金', asset_class: '权益', industry: '制造', market_value: 400000, cost_value: 400000 },
      { security_code: 'FB01.CN', security_name: '国债ETF', asset_class: '固收', industry: '利率债', market_value: 1800000, cost_value: 1780000 },
      { security_code: 'FB02.CN', security_name: '信用债基金', asset_class: '固收', industry: '信用债', market_value: 1600000, cost_value: 1590000 },
      { security_code: 'FB03.CN', security_name: '金融债基金', asset_class: '固收', industry: '金融债', market_value: 1000000, cost_value: 1000000 },
      { security_code: 'FA01.CN', security_name: '债权投资计划', asset_class: '另类', industry: '基础设施', market_value: 400000, cost_value: 400000 },
      { security_code: 'FC01.CN', security_name: '货币基金', asset_class: '现金', industry: '货币', market_value: 400000, cost_value: 400000 },
    ],
    '万能': [
      { security_code: 'W001.OF', security_name: '宽基指数基金', asset_class: '权益', industry: '宽基', market_value: 800000, cost_value: 820000 },
      { security_code: 'W002.OF', security_name: '红利策略基金', asset_class: '权益', industry: '红利', market_value: 700000, cost_value: 680000 },
      { security_code: 'WB01.CN', security_name: '国债ETF', asset_class: '固收', industry: '利率债', market_value: 1500000, cost_value: 1480000 },
      { security_code: 'WB02.CN', security_name: '信用债基金', asset_class: '固收', industry: '信用债', market_value: 1200000, cost_value: 1190000 },
      { security_code: 'WB03.CN', security_name: '城投债组合', asset_class: '固收', industry: '城投', market_value: 900000, cost_value: 910000 },
      { security_code: 'WA01.CN', security_name: '未上市股权计划', asset_class: '另类', industry: '股权', market_value: 600000, cost_value: 600000 },
      { security_code: 'WC01.CN', security_name: '货币基金', asset_class: '现金', industry: '货币', market_value: 300000, cost_value: 300000 },
    ],
  };

  /* ============================================================
   * 三、数据获取（导入优先，模拟兜底）
   * ============================================================ */
  function mapToAnalysis(row) {
    const qty = Number(row.quantity) || 0;
    const cost = Number(row.cost_price) || 0;
    return {
      security_code: String(row.security_code || '').trim(),
      security_name: String(row.security_name || '').trim(),
      asset_class: String(row.asset_class || '').trim(),
      industry: row.industry || '未分类',
      market_value: Number(row.market_value) || (qty * (Number(row.market_price) || 0)),
      cost_value: +(qty * cost).toFixed(2),
    };
  }

  function getHoldings(account) {
    if (typeof PortfolioImporter !== 'undefined' && PortfolioImporter.getHoldings) {
      const imported = PortfolioImporter.getHoldings(account);
      if (imported && imported.length > 0) return imported.map(mapToAnalysis);
    }
    return (MOCK_HOLDINGS[account] || []).map((h) => ({ ...h }));
  }

  /* ============================================================
   * 四、分析计算
   * ============================================================ */
  function aggregate(holdings, dim) {
    const map = {};
    holdings.forEach((h) => { map[h[dim]] = (map[h[dim]] || 0) + h.market_value; });
    return Object.keys(map).map((k) => ({ name: k, value: Math.round(map[k]) }))
      .sort((a, b) => b.value - a.value);
  }

  function compute(account) {
    const holdings = getHoldings(account);
    const config = ACCOUNT_CONFIG[account] || { solvency: 132, duration: { asset: 5, liability: 8 } };
    const total = holdings.reduce((s, h) => s + h.market_value, 0);

    const allocation = aggregate(holdings, 'asset_class');
    const industry = aggregate(holdings, 'industry');

    const equityValue = allocation.find((a) => a.name === '权益')?.value || 0;
    const equityPct = total > 0 ? +((equityValue / total) * 100).toFixed(1) : 0;

    const top10 = holdings.slice().sort((a, b) => b.market_value - a.market_value).slice(0, 10)
      .map((h) => ({ ...h, pct: total > 0 ? +((h.market_value / total) * 100).toFixed(2) : 0 }));
    // 单一发行人：排除主权/利率债/货币等无信用风险资产，取剩余最大持仓占比
    const issuerHoldings = holdings.filter((h) =>
      h.asset_class !== '现金' && !['利率债', '货币'].includes(h.industry)
    );
    const maxIssuer = issuerHoldings.length > 0
      ? issuerHoldings.reduce((a, b) => (a.market_value > b.market_value ? a : b))
      : null;
    const maxIssuerPct = maxIssuer ? +((maxIssuer.market_value / total) * 100).toFixed(2) : 0;

    const pnl = holdings.map((h) => ({ name: h.security_name, pnl: Math.round(h.market_value - h.cost_value) }))
      .sort((a, b) => b.pnl - a.pnl);

    const durGap = +(config.duration.asset - config.duration.liability).toFixed(2);

    // 监管红线
    const redline = [
      { label: '权益占比', value: equityPct, threshold: 45, unit: '%', breach: equityPct > 45, dir: 'gt' },
      { label: '单一发行人', value: maxIssuerPct, threshold: 10, unit: '%', breach: maxIssuerPct > 10, dir: 'gt' },
      { label: '偿付能力充足率', value: config.solvency, threshold: 120, unit: '%', breach: config.solvency < 120, dir: 'lt' },
    ];

    return {
      account, holdings, total, allocation, industry, top10,
      maxIssuerPct, equityPct, pnl, durGap, duration: config.duration,
      solvency: config.solvency, redline, breachCount: redline.filter((r) => r.breach).length,
    };
  }

  /* ============================================================
   * 五、渲染
   * ============================================================ */
  async function render(container, account, echartsLib) {
    const d = compute(account);

    // 1) 资产配置饼图
    const allocEl = container.querySelector('.pa-allocation-chart');
    if (allocEl && echartsLib) {
      const palette = { '权益': '#ef4444', '固收': '#0F4C81', '另类': '#f59e0b', '现金': '#10b981' };
      const chart = echartsLib.init(allocEl);
      chart.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { bottom: 0, textStyle: { color: '#64748b', fontSize: 10 } },
        series: [{
          type: 'pie', radius: ['40%', '66%'], center: ['50%', '44%'],
          label: { color: '#334155', fontSize: 10, formatter: '{b}\n{d}%' },
          data: d.allocation.map((a) => ({ name: a.name, value: a.value, itemStyle: { color: palette[a.name] || '#94a3b8' } })),
        }],
      });
      container.__allocChart = chart;
    }

    // 2) 行业分布条形图
    const indEl = container.querySelector('.pa-industry-chart');
    if (indEl && echartsLib) {
      const chart = echartsLib.init(indEl);
      const data = d.industry.slice(0, 8).reverse();
      chart.setOption({
        grid: { left: 70, right: 30, top: 10, bottom: 24 },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        xAxis: { type: 'value', axisLabel: { color: '#64748b', fontSize: 9, formatter: (v) => (v / 10000) + '万' }, splitLine: { lineStyle: { color: '#eef2f7' } } },
        yAxis: { type: 'category', data: data.map((x) => x.name), axisLabel: { color: '#64748b', fontSize: 10 } },
        series: [{ type: 'bar', barWidth: '55%', data: data.map((x) => ({ value: x.value, itemStyle: { color: '#0F4C81', borderRadius: [0, 4, 4, 0] } })) }],
      });
      container.__industryChart = chart;
    }

    // 3) 个券集中度 TOP10
    const topEl = container.querySelector('.pa-top10');
    if (topEl) {
      const maxVal = d.top10[0]?.market_value || 1;
      topEl.innerHTML = d.top10.map((h, i) => {
        const breach = h.pct > 10;
        return `<div class="pa-top-row ${breach ? 'breach' : ''}">
          <span class="pa-top-idx">${i + 1}</span>
          <span class="pa-top-name" title="${h.security_name}">${h.security_name}</span>
          <div class="pa-top-track"><div class="pa-top-fill ${breach ? 'danger' : ''}" style="width:${(h.market_value / maxVal) * 100}%"></div></div>
          <span class="pa-top-pct ${breach ? 'danger' : ''}">${h.pct}%</span>
          ${breach ? '<span class="pa-top-tag">超10%</span>' : ''}
        </div>`;
      }).join('') || '<div style="color:#94a3b8;text-align:center;padding:20px">无持仓数据</div>';
    }

    // 4) 盈亏分布（正负柱状图）
    const pnlEl = container.querySelector('.pa-pnl-chart');
    if (pnlEl && echartsLib) {
      const chart = echartsLib.init(pnlEl);
      chart.setOption({
        grid: { left: 50, right: 20, top: 16, bottom: 24 },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (p) => { const x = d.pnl[p[0].dataIndex]; return `${x.name}<br/>盈亏 <b>${x.pnl > 0 ? '+' : ''}${(x.pnl / 10000).toFixed(1)}万</b>`; } },
        xAxis: { type: 'category', data: d.pnl.map((x) => x.name), axisLabel: { color: '#64748b', fontSize: 8, interval: 0, rotate: 35 } },
        yAxis: { type: 'value', axisLabel: { color: '#64748b', fontSize: 9, formatter: (v) => (v / 10000) + '万' }, splitLine: { lineStyle: { color: '#eef2f7' } } },
        series: [{
          type: 'bar', barWidth: '60%',
          data: d.pnl.map((x) => ({
            value: x.pnl,
            itemStyle: { color: x.pnl >= 0 ? '#10b981' : '#ef4444', borderRadius: x.pnl >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3] },
          })),
        }],
      });
      container.__pnlChart = chart;
    }

    // 5) 久期分析
    const durEl = container.querySelector('.pa-duration');
    if (durEl) {
      const gapCls = d.durGap < 0 ? 'warn' : 'ok';
      durEl.innerHTML = `<div class="pa-dur-gap ${gapCls}">
          <div class="pa-dur-num">${d.durGap >= 0 ? '+' : ''}${d.durGap.toFixed(2)} 年</div>
          <div class="pa-dur-sub">资产久期 ${d.duration.asset} − 负债久期 ${d.duration.liability}</div>
        </div>
        <div class="pa-dur-rows">
          <div class="pa-dur-row"><span>资产久期</span><div class="pa-dur-bar"><div style="width:${d.duration.asset / 10 * 100}%"></div></div><b>${d.duration.asset}</b></div>
          <div class="pa-dur-row"><span>负债久期</span><div class="pa-dur-bar"><div class="liab" style="width:${d.duration.liability / 10 * 100}%"></div></div><b>${d.duration.liability}</b></div>
        </div>`;
    }

    // 6) 监管红线仪表盘
    const redEl = container.querySelector('.pa-redline');
    if (redEl) {
      redEl.innerHTML = d.redline.map((r) => {
        const pct = Math.min(r.value / r.threshold * 100, 100);
        return `<div class="pa-red-row ${r.breach ? 'breach' : ''}">
          <span class="pa-red-label">${r.label}</span>
          <div class="pa-red-track"><div class="pa-red-fill ${r.breach ? 'danger' : 'ok'}" style="width:${pct}%"></div><div class="pa-red-threshold" style="left:${Math.min(r.threshold / (r.threshold * 1.5) * 100, 95)}%"></div></div>
          <span class="pa-red-val ${r.breach ? 'danger' : ''}">${r.value}${r.unit}</span>
          <span class="pa-red-status ${r.breach ? 'danger' : 'ok'}">${r.breach ? '🔴 超标' : '✅ 正常'}</span>
        </div>`;
      }).join('');
    }

    return d;
  }

  function resize(container) {
    ['__allocChart', '__industryChart', '__pnlChart'].forEach((k) => {
      if (container && container[k]) container[k].resize();
    });
  }

  global.HoldingAnalysis = { ACCOUNT_CONFIG, MOCK_HOLDINGS, getHoldings, compute, render, resize };
})(window);
