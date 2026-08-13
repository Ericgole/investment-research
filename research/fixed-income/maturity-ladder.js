/**
 * maturity-ladder.js — 债券到期结构（险资底层资产 · 模块三）
 *
 * 职责：未来 36 个月到期现金流瀑布、累计到期曲线、再投资压力、久期缺口
 * 数据策略：内置确定性伪随机生成，断网可用，不调用真实 API
 */
(function (global) {
  'use strict';

  /* ============================================================
   * 一、确定性伪随机（可复现）
   * ============================================================ */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ============================================================
   * 二、数据生成（未来 36 个月）
   * ============================================================ */
  const BASE_MONTHS = 36;
  const FIXED_HEAD = [1.2, 2.5, 0.8]; // 2026-09 / 2026-12 / 2027-03（亿元）

  function monthLabel(offset) {
    const y = 2026 + Math.floor((8 + offset) / 12);
    const m = ((8 + offset) % 12) + 1;
    return y + '-' + String(m).padStart(2, '0');
  }

  function generateLadder() {
    const rnd = mulberry32(20260813);
    const ladder = [];
    let total = 0;
    for (let i = 0; i < BASE_MONTHS; i++) {
      // 前 3 个月用给定值，其余 0.6 ~ 2.8 亿之间波动，季末偏大
      let amount;
      if (i < FIXED_HEAD.length) {
        amount = FIXED_HEAD[i];
      } else {
        const base = 1.35 + Math.sin(i * 0.9) * 0.35;
        const noise = (rnd() - 0.5) * 0.8;
        const quarter = i % 3 === 2 ? 0.5 : 0; // 季末集中到期
        amount = Math.max(0.6, Math.min(2.8, base + noise + quarter));
      }
      amount = +amount.toFixed(2);
      total += amount;
      ladder.push({ month: monthLabel(i), amount, cum: +total.toFixed(2) });
    }
    return { ladder, total: +total.toFixed(2), months: BASE_MONTHS };
  }

  const SOURCE = {
    ladderData: generateLadder(),
    // 资产/负债久期（年）
    duration: { asset: 5.2, liability: 8.5 },
    // 月均新增可投资金（亿元），用于再投资压力
    monthlyNewFund: 2.0,
    asOf: '2026-08-13',
  };

  /* ============================================================
   * 三、指标计算
   * ============================================================ */
  function compute() {
    const durGap = +(SOURCE.duration.asset - SOURCE.duration.liability).toFixed(2);
    const maxMonth = SOURCE.ladderData.ladder.reduce((a, b) => (a.amount > b.amount ? a : b));
    // 再投资压力指数 = 当月到期金额 / 月均新增资金（>1 表示到期需再投资超过新增供给）
    const maxPressure = +(maxMonth.amount / SOURCE.monthlyNewFund).toFixed(2);
    const pressureList = SOURCE.ladderData.ladder.map((d) => ({
      month: d.month,
      pressure: +(d.amount / SOURCE.monthlyNewFund).toFixed(2),
    }));
    return {
      durGap,
      gapNegative: durGap < 0,
      maxMonth,
      maxPressure,
      pressureList,
      total: SOURCE.ladderData.total,
      avgMonthly: +(SOURCE.ladderData.total / SOURCE.months).toFixed(2),
    };
  }

  /* ============================================================
   * 四、渲染
   * ============================================================ */
  async function render(container, echartsLib) {
    const m = compute();
    const ladder = SOURCE.ladderData.ladder;

    // 1) 到期现金流柱状图 + 累计曲线（双系列）
    const chartEl = container.querySelector('.fi-maturity-chart');
    if (chartEl && echartsLib) {
      const chart = echartsLib.init(chartEl);
      chart.setOption({
        grid: { left: 50, right: 48, top: 24, bottom: 32 },
        tooltip: {
          trigger: 'axis',
          formatter: (params) => {
            const idx = params[0].dataIndex;
            const d = ladder[idx];
            return `${d.month}<br/>到期 <b>${d.amount.toFixed(2)}亿</b><br/>累计 ${d.cum.toFixed(2)}亿`;
          },
        },
        xAxis: {
          type: 'category',
          data: ladder.map((d) => d.month),
          axisLabel: { color: '#64748b', fontSize: 9, interval: 2, rotate: 40 },
          axisLine: { lineStyle: { color: '#cbd5e1' } },
        },
        yAxis: [
          { type: 'value', name: '到期(亿)', axisLabel: { color: '#64748b', fontSize: 9 }, splitLine: { lineStyle: { color: '#eef2f7' } } },
          { type: 'value', name: '累计(亿)', axisLabel: { color: '#94a3b8', fontSize: 9 }, splitLine: { show: false } },
        ],
        series: [
          {
            name: '月度到期',
            type: 'bar',
            barWidth: '55%',
            data: ladder.map((d) => ({
              value: d.amount,
              itemStyle: { color: d.amount >= 2.5 ? '#ef4444' : d.amount >= 1.8 ? '#f59e0b' : '#0F4C81', borderRadius: [3, 3, 0, 0] },
            })),
          },
          {
            name: '累计到期',
            type: 'line',
            yAxisIndex: 1,
            data: ladder.map((d) => d.cum),
            smooth: true,
            symbol: 'none',
            lineStyle: { color: '#10b981', width: 2 },
          },
        ],
      });
      container.__maturityChart = chart;
    }

    // 2) 久期缺口卡片
    const gapEl = container.querySelector('.fi-dur-gap');
    if (gapEl) {
      const numEl = gapEl.querySelector('.fi-dur-num');
      const subEl = gapEl.querySelector('.fi-dur-sub');
      if (numEl) numEl.textContent = (m.durGap >= 0 ? '+' : '') + m.durGap.toFixed(2) + ' 年';
      if (subEl) subEl.textContent = `资产久期 ${SOURCE.duration.asset} − 负债久期 ${SOURCE.duration.liability}`;
      gapEl.className = 'fi-dur-gap ' + (m.gapNegative ? 'warn' : 'ok');
    }

    // 3) 再投资压力指数
    const pressEl = container.querySelector('.fi-pressure');
    if (pressEl) {
      pressEl.innerHTML = `峰值压力指数 <b>${m.maxPressure.toFixed(2)}</b>（${m.maxMonth.month} 到期 ${m.maxMonth.amount.toFixed(2)}亿 ÷ 月均新增 ${SOURCE.monthlyNewFund.toFixed(1)}亿）<br>
      <span style="font-size:10px;color:#64748b">>1 表示到期规模超过新增资金供给，需提前规划再投资衔接。</span>`;
    }

    // 4) 汇总文本
    const sumEl = container.querySelector('.fi-maturity-sum');
    if (sumEl) {
      sumEl.innerHTML = `未来 36 个月累计到期 <b>${m.total.toFixed(1)}亿</b> · 月均 ${m.avgMonthly.toFixed(2)}亿 · 样本期 2026-09 ~ ${ladder[ladder.length - 1].month}`;
    }

    return m;
  }

  function resize(container) {
    if (container && container.__maturityChart) container.__maturityChart.resize();
  }

  global.MaturityLadder = { SOURCE, compute, generateLadder, render, resize };
})(window);
