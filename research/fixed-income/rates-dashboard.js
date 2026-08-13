/**
 * rates-dashboard.js — 利率债看板（险资底层资产 · 模块一）
 *
 * 职责：国债收益率曲线、期限利差历史分位、负债成本利差告警
 * 数据策略：全部硬编码内置，断网可用，不调用真实 API
 * 代码风格：ES6+ / async-await，与投研体系 v2.0 现有模块一致
 */
(function (global) {
  'use strict';

  /* ============================================================
   * 一、数据源（内置降级）
   * ============================================================ */
  const SOURCE = {
    // 国债收益率曲线（%）+ 当日变动（bp）
    curve: [
      { tenor: '1Y',  yield: 1.52, change: -2 },
      { tenor: '3Y',  yield: 1.78, change: -1 },
      { tenor: '5Y',  yield: 2.05, change: 0  },
      { tenor: '7Y',  yield: 2.28, change: 1  },
      { tenor: '10Y', yield: 2.45, change: 2  },
    ],
    // 期限利差 10Y-1Y（bp）+ 历史分位（%）
    spread: { valueBp: 93, percentile: 35 },
    // 保单负债成本假定（%）
    liabilityCost: 3.0,
    // 更新日期（模拟最新交易日）
    asOf: '2026-08-13',
  };

  /* ============================================================
   * 二、指标计算
   * ============================================================ */
  function compute() {
    const y10 = SOURCE.curve.find((d) => d.tenor === '10Y').yield;
    const y1 = SOURCE.curve.find((d) => d.tenor === '1Y').yield;
    // 利差 = 10Y 国债收益率 - 负债成本（%）
    const spreadVsLiability = +(y10 - SOURCE.liabilityCost).toFixed(2);
    // 实际期限利差（bp）
    const spreadBp = Math.round((y10 - y1) * 100);
    return {
      y10,
      y1,
      spreadVsLiability,
      spreadBp,
      liabilityCost: SOURCE.liabilityCost,
      negative: spreadVsLiability < 0, // 负利差告警
      spreadPercentile: SOURCE.spread.percentile,
    };
  }

  /* ============================================================
   * 三、渲染
   * ============================================================ */
  async function render(container, echartsLib) {
    const m = compute();

    // 1) 收益率曲线折线图
    const chartEl = container.querySelector('.fi-rates-chart');
    if (chartEl && echartsLib) {
      const chart = echartsLib.init(chartEl);
      chart.setOption({
        grid: { left: 44, right: 16, top: 24, bottom: 28 },
        tooltip: {
          trigger: 'axis',
          formatter: (params) => {
            const p = params[0];
            const d = SOURCE.curve[p.dataIndex];
            const chg = d.change > 0 ? `+${d.change}` : `${d.change}`;
            return `${p.axisValue} 国债<br/>收益率 <b>${d.yield.toFixed(2)}%</b><br/>日变动 ${chg}bp`;
          },
        },
        xAxis: {
          type: 'category',
          data: SOURCE.curve.map((d) => d.tenor),
          axisLine: { lineStyle: { color: '#cbd5e1' } },
          axisLabel: { color: '#64748b', fontSize: 11 },
        },
        yAxis: {
          type: 'value',
          name: '%',
          min: 1.3,
          max: 2.6,
          axisLabel: { color: '#64748b', fontSize: 10 },
          splitLine: { lineStyle: { color: '#eef2f7' } },
        },
        series: [{
          type: 'line',
          data: SOURCE.curve.map((d) => d.yield),
          smooth: true,
          symbol: 'circle',
          symbolSize: 7,
          lineStyle: { color: '#0F4C81', width: 3 },
          itemStyle: { color: '#0F4C81', borderColor: '#fff', borderWidth: 2 },
          areaStyle: {
            color: new echartsLib.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(15,76,129,0.20)' },
              { offset: 1, color: 'rgba(15,76,129,0.02)' },
            ]),
          },
          label: {
            show: true,
            position: 'top',
            color: '#0F4C81',
            fontSize: 10,
            fontWeight: 600,
            formatter: (p) => p.value.toFixed(2) + '%',
          },
        }],
      });
      container.__ratesChart = chart;
    }

    // 2) 期限利差分位进度条
    const barFill = container.querySelector('.fi-spread-fill');
    const barVal = container.querySelector('.fi-spread-val');
    if (barFill) {
      barFill.style.width = m.spreadPercentile + '%';
      barFill.className = 'fi-spread-fill ' + (m.spreadPercentile < 40 ? 'low' : m.spreadPercentile < 70 ? 'mid' : 'high');
    }
    if (barVal) barVal.textContent = m.spreadPercentile + '%';

    // 3) 日变动标签
    const changeWrap = container.querySelector('.fi-change-list');
    if (changeWrap) {
      changeWrap.innerHTML = SOURCE.curve.map((d) => {
        const cls = d.change > 0 ? 'up' : d.change < 0 ? 'down' : 'flat';
        const txt = d.change > 0 ? `+${d.change}` : `${d.change}`;
        return `<span class="fi-change ${cls}">${d.tenor} ${txt}bp</span>`;
      }).join('');
    }

    // 4) 利差告警卡片
    const alertCard = container.querySelector('.fi-spread-alert');
    if (alertCard) {
      const valEl = alertCard.querySelector('.fi-spread-num');
      const lblEl = alertCard.querySelector('.fi-spread-lbl');
      if (valEl) valEl.textContent = (m.spreadVsLiability >= 0 ? '+' : '') + m.spreadVsLiability.toFixed(2) + '%';
      if (lblEl) lblEl.textContent = `${m.y10.toFixed(2)}% (10Y) − ${m.liabilityCost.toFixed(1)}% (负债成本)`;
      alertCard.classList.toggle('negative', m.negative);
      alertCard.classList.toggle('positive', !m.negative);
    }

    // 5) 文本结论
    const noteEl = container.querySelector('.fi-rates-note');
    if (noteEl) {
      noteEl.innerHTML = m.negative
        ? `<b style="color:#ef4444">⚠ 负利差 −${Math.abs(m.spreadVsLiability).toFixed(2)}%</b>：10Y 国债收益率已低于保单负债成本，新增固收配置面临<b>利差损</b>压力，需拉长久期或增配高等级信用债补收益。`
        : `<b style="color:#10b981">正利差 +${m.spreadVsLiability.toFixed(2)}%</b>：资产端收益覆盖负债成本，配置安全垫充足。`;
    }

    return m;
  }

  /* 窗口 resize 自适应 */
  function resize(container) {
    if (container && container.__ratesChart) container.__ratesChart.resize();
  }

  global.RatesDashboard = { SOURCE, compute, render, resize };
})(window);
