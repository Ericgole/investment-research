/**
 * credit-dashboard.js — 信用债看板（险资底层资产 · 模块二）
 *
 * 职责：AAA/AA+/AA 信用利差分级、城投/产业/金融三列、单一发行人集中度告警
 * 数据策略：全部硬编码内置，断网可用，不调用真实 API
 */
(function (global) {
  'use strict';

  /* ============================================================
   * 一、数据源（内置降级）
   * ============================================================ */
  const SOURCE = {
    // 信用利差分级（bp）+ 历史分位（%）+ 趋势（up=走阔/down=收窄/flat=持平）
    ratings: [
      { rating: 'AAA', bp: 65,  percentile: 40, trend: 'down' },
      { rating: 'AA+', bp: 95,  percentile: 55, trend: 'flat' },
      { rating: 'AA',  bp: 140, percentile: 60, trend: 'up'   },
    ],
    // 三大类信用债：利差/分位/趋势
    sectors: [
      { name: '城投债', bp: 88,  percentile: 52, trend: 'up'   },
      { name: '产业债', bp: 112, percentile: 58, trend: 'flat' },
      { name: '金融债', bp: 45,  percentile: 38, trend: 'down' },
    ],
    // 单一发行人集中度（%）= 某发行人持仓 / 总信用债市值
    concentration: {
      threshold: 10,
      issuers: [
        { name: '某省高速集团',  pct: 12.5, rating: 'AAA', region: '东部' },
        { name: '某城商行',      pct: 7.2,  rating: 'AA+', region: '中部' },
        { name: '某能源国企',    pct: 5.8,  rating: 'AAA', region: '西部' },
      ],
    },
    asOf: '2026-08-13',
  };

  /* ============================================================
   * 二、指标计算
   * ============================================================ */
  function compute() {
    const breaches = SOURCE.concentration.issuers.filter((i) => i.pct > SOURCE.concentration.threshold);
    const maxIssuer = SOURCE.concentration.issuers.reduce((a, b) => (a.pct > b.pct ? a : b));
    return {
      breaches,
      hasBreach: breaches.length > 0,
      maxIssuer,
      threshold: SOURCE.concentration.threshold,
    };
  }

  /* ============================================================
   * 三、渲染
   * ============================================================ */
  async function render(container, echartsLib) {
    const m = compute();

    // 1) 信用利差分级柱状图
    const chartEl = container.querySelector('.fi-credit-chart');
    if (chartEl && echartsLib) {
      const chart = echartsLib.init(chartEl);
      chart.setOption({
        grid: { left: 44, right: 16, top: 20, bottom: 28 },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params) => {
            const p = params[0];
            const d = SOURCE.ratings[p.dataIndex];
            return `${d.rating} 信用利差<br/><b>${d.bp}bp</b> · 历史分位 ${d.percentile}%`;
          },
        },
        xAxis: {
          type: 'category',
          data: SOURCE.ratings.map((d) => d.rating),
          axisLine: { lineStyle: { color: '#cbd5e1' } },
          axisLabel: { color: '#64748b', fontSize: 11, fontWeight: 600 },
        },
        yAxis: {
          type: 'value',
          name: 'bp',
          axisLabel: { color: '#64748b', fontSize: 10 },
          splitLine: { lineStyle: { color: '#eef2f7' } },
        },
        series: [{
          type: 'bar',
          barWidth: '45%',
          data: SOURCE.ratings.map((d) => ({
            value: d.bp,
            itemStyle: { color: d.bp >= 140 ? '#ef4444' : d.bp >= 95 ? '#f59e0b' : '#0F4C81', borderRadius: [4, 4, 0, 0] },
          })),
          label: {
            show: true,
            position: 'top',
            color: '#334155',
            fontSize: 11,
            fontWeight: 600,
            formatter: (p) => p.value + 'bp',
          },
        }],
      });
      container.__creditChart = chart;
    }

    // 2) 城投/产业/金融三列卡片
    const secWrap = container.querySelector('.fi-sector-cards');
    if (secWrap) {
      secWrap.innerHTML = SOURCE.sectors.map((s) => {
        const arrow = s.trend === 'up' ? '▲' : s.trend === 'down' ? '▼' : '—';
        const cls = s.trend === 'up' ? 'up' : s.trend === 'down' ? 'down' : 'flat';
        const pctCls = s.percentile < 40 ? 'low' : s.percentile < 60 ? 'mid' : 'high';
        return `<div class="fi-sector">
          <div class="fi-sector-name">${s.name}</div>
          <div class="fi-sector-bp">${s.bp}<span>bp</span></div>
          <div class="fi-sector-meta">
            <span>分位 ${s.percentile}%</span>
            <span class="fi-arrow ${cls}">${arrow}</span>
          </div>
          <div class="fi-sector-bar"><div class="fi-sector-fill ${pctCls}" style="width:${s.percentile}%"></div></div>
        </div>`;
      }).join('');
    }

    // 3) 单一发行人集中度
    const concEl = container.querySelector('.fi-conc');
    if (concEl) {
      concEl.innerHTML = SOURCE.concentration.issuers.map((i) => {
        const breach = i.pct > SOURCE.concentration.threshold;
        return `<div class="fi-conc-row ${breach ? 'breach' : ''}">
          <span class="fi-conc-name">${i.name} <i>(${i.rating})</i></span>
          <div class="fi-conc-bar"><div class="fi-conc-fill ${breach ? 'danger' : 'ok'}" style="width:${Math.min(i.pct * 6, 100)}%"></div></div>
          <span class="fi-conc-pct ${breach ? 'danger' : ''}">${i.pct}%</span>
          ${breach ? '<span class="fi-conc-tag">超限</span>' : ''}
        </div>`;
      }).join('');
    }

    // 4) 告警横幅
    const alertEl = container.querySelector('.fi-credit-alert');
    if (alertEl) {
      if (m.hasBreach) {
        alertEl.style.display = 'block';
        alertEl.innerHTML = `⚠ <b>集中度超限</b>：${m.breaches.map((b) => `${b.name} ${b.pct}%`).join('、')} 超过 ${m.threshold}% 监管红线，需分散或压降。`;
      } else {
        alertEl.style.display = 'none';
      }
    }

    return m;
  }

  function resize(container) {
    if (container && container.__creditChart) container.__creditChart.resize();
  }

  global.CreditDashboard = { SOURCE, compute, render, resize };
})(window);
