/**
 * credit-risk.js — 信用风险穿透（险资底层资产 · 模块四）
 *
 * 职责：发行人持仓穿透、区域集中度、行业集中度、预警清单、偿付敏感度
 * 数据策略：全部硬编码内置，断网可用，不调用真实 API
 * 说明：区域集中度采用「省份列表热力条」呈现（规避地图边界合规风险）
 */
(function (global) {
  'use strict';

  /* ============================================================
   * 一、数据源（内置降级）
   * ============================================================ */
  const SOURCE = {
    // 信用债持仓（万元）
    holdings: [
      { name: '发行人A', rating: 'AAA', sector: '城投', region: '江苏', amount: 5000, risk: false },
      { name: '发行人B', rating: 'AA+', sector: '产业', region: '广东', amount: 3000, risk: false },
      { name: '发行人C', rating: 'AA',  sector: '城投', region: '贵州', amount: 2000, risk: true  },
      { name: '发行人D', rating: 'AAA', sector: '金融', region: '北京', amount: 4000, risk: false },
      { name: '发行人E', rating: 'AA+', sector: '城投', region: '浙江', amount: 2500, risk: false },
      { name: '发行人F', rating: 'AAA', sector: '产业', region: '山东', amount: 1800, risk: false },
    ],
    // 预警清单
    warnings: [
      { issuer: '发行人C', rating: 'AA', type: '评级下调', detail: 'AA → AA-，展望负面（区域财政承压）', level: 'high' },
      { issuer: '某地产债', rating: 'AA', type: '负面展望', detail: '行业景气下行，销售回款放缓', level: 'mid' },
      { issuer: '某超短融', rating: 'AAA', type: '到期<3个月', detail: '2026-11 到期 1.5 亿，需备兑付资金', level: 'low' },
    ],
    // 偿付能力敏感度（信用利差扩大 100bp 情景）
    sensitivity: { spreadBp: 100, solvencyDropPct: 3.8, baseSolvency: 132 },
    asOf: '2026-08-13',
  };

  /* ============================================================
   * 二、指标计算
   * ============================================================ */
  function aggregateBy(dim) {
    const map = {};
    SOURCE.holdings.forEach((h) => {
      const key = h[dim];
      map[key] = (map[key] || 0) + h.amount;
    });
    return Object.keys(map).map((k) => ({ name: k, value: map[k] }));
  }

  function compute() {
    const total = SOURCE.holdings.reduce((s, h) => s + h.amount, 0);
    const byRegion = aggregateBy('region').sort((a, b) => b.value - a.value);
    const bySector = aggregateBy('sector');
    const maxRegion = byRegion[0];
    // 区域集中度 = 最大省份 / 总持仓
    const regionConcentration = +((maxRegion.value / total) * 100).toFixed(1);
    const riskHoldings = SOURCE.holdings.filter((h) => h.risk);
    const afterShock = +(SOURCE.sensitivity.baseSolvency - SOURCE.sensitivity.solvencyDropPct).toFixed(1);
    return {
      total,
      byRegion,
      bySector,
      maxRegion,
      regionConcentration,
      riskHoldings,
      afterShock,
      maxRegionPct: +((maxRegion.value / total) * 100).toFixed(1),
    };
  }

  /* ============================================================
   * 三、渲染
   * ============================================================ */
  async function render(container, echartsLib) {
    const m = compute();
    const maxVal = m.byRegion[0].value;

    // 1) 区域集中度 —— 省份热力条
    const regionEl = container.querySelector('.fi-region-heat');
    if (regionEl) {
      regionEl.innerHTML = m.byRegion.map((r) => {
        const pct = Math.round((r.value / maxVal) * 100);
        const share = ((r.value / m.total) * 100).toFixed(1);
        const hot = r.value / m.total >= 0.3 ? 'hot' : r.value / m.total >= 0.15 ? 'warm' : 'cool';
        return `<div class="fi-region-row">
          <span class="fi-region-name">${r.name}</span>
          <div class="fi-region-track"><div class="fi-region-fill ${hot}" style="width:${pct}%"></div></div>
          <span class="fi-region-val">${r.value}<i>万</i> <b>${share}%</b></span>
        </div>`;
      }).join('');
    }

    // 2) 行业集中度饼图
    const chartEl = container.querySelector('.fi-sector-chart');
    if (chartEl && echartsLib) {
      const chart = echartsLib.init(chartEl);
      const palette = { '城投': '#0F4C81', '产业': '#f59e0b', '金融': '#10b981' };
      chart.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: {c}万 ({d}%)' },
        legend: { bottom: 0, textStyle: { color: '#64748b', fontSize: 10 } },
        series: [{
          type: 'pie',
          radius: ['42%', '68%'],
          center: ['50%', '44%'],
          label: { color: '#334155', fontSize: 10, formatter: '{b}\n{d}%' },
          data: m.bySector.map((s) => ({ name: s.name, value: s.value, itemStyle: { color: palette[s.name] || '#94a3b8' } })),
        }],
      });
      container.__sectorChart = chart;
    }

    // 3) 预警清单表格
    const warnEl = container.querySelector('.fi-warning-table tbody');
    if (warnEl) {
      const lv = { high: '高', mid: '中', low: '低' };
      const lvCls = { high: 'danger', mid: 'warn', low: 'ok' };
      warnEl.innerHTML = SOURCE.warnings.map((w) => `<tr>
        <td>${w.issuer}</td>
        <td>${w.rating}</td>
        <td><span class="fi-tag ${lvCls[w.level]}">${w.type}</span></td>
        <td>${w.detail}</td>
        <td>${lv[w.level]}</td>
      </tr>`).join('');
    }

    // 4) 偿付敏感度
    const sensEl = container.querySelector('.fi-sensitivity');
    if (sensEl) {
      sensEl.innerHTML = `信用利差扩大 <b>+${SOURCE.sensitivity.spreadBp}bp</b> → 偿付充足率 <b>${SOURCE.sensitivity.baseSolvency}%</b> 下降至 <b style="color:#ef4444">${m.afterShock}%</b>（-${SOURCE.sensitivity.solvencyDropPct} pct）`;
    }

    // 5) 区域集中度结论
    const noteEl = container.querySelector('.fi-risk-note');
    if (noteEl) {
      noteEl.innerHTML = m.regionConcentration >= 30
        ? `<b style="color:#ef4444">⚠ 区域集中度 ${m.regionConcentration}%</b>：${m.maxRegion.name} 单省占比过高，且 ${m.riskHoldings.map((h) => h.name).join('、')} 存在区域风险，建议压降敞口。`
        : `<b style="color:#10b981">区域集中度 ${m.regionConcentration}%</b>：分布相对均衡，无单一省份超 30% 红线。`;
    }

    return m;
  }

  function resize(container) {
    if (container && container.__sectorChart) container.__sectorChart.resize();
  }

  global.CreditRisk = { SOURCE, compute, render, resize };
})(window);
