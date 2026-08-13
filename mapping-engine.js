// ===== 投研体系 v2.0 · 透明映射引擎 =====
// 专题 → 五维聚合 → TAA 加权总分
// 每个计算步骤均可追溯: 哪个专题贡献了多少分
// 权重与评分对齐 data/taa.json（保险资金版 TAA计分卡）
//   宏观25% / 估值25% / 政策20% / 资金15% / 技术15%
//   目标五维: 宏观+1.0 / 估值-0.5 / 政策+2.5 / 资金+1.5 / 技术0.0
//   加权总分 = 1.0×0.25 + (-0.5)×0.25 + 2.5×0.20 + 1.5×0.15 + 0×0.15 = +0.85

var MAPPING = {
  宏观研判: {
    weight: 25,
    topics: [
      {id:'宏观1',name:'政策宽松（降准降息）',score:2.0,weight:30,contrib:function(){return this.score*this.weight/100*0.25}},
      {id:'宏观2',name:'出口韧性',score:1.0,weight:25,contrib:function(){return this.score*this.weight/100*0.25}},
      {id:'宏观8',name:'流动性宽裕 DR007',score:1.0,weight:25,contrib:function(){return this.score*this.weight/100*0.25}},
      {id:'宏观14',name:'PMI 跌破荣枯线',score:-0.5,weight:20,contrib:function(){return this.score*this.weight/100*0.25}}
    ],
    aggregated: function(){
      var s=this.topics;var t=0;for(var i=0;i<s.length;i++)t+=s[i].score*s[i].weight;return (t/100);
    }
  },
  市场估值: {
    weight: 25,
    topics: [
      {id:'估值1',name:'PE/PB 历史分位',score:-1.0,weight:40,contrib:function(){return this.score*this.weight/100*0.25}},
      {id:'估值5',name:'ERP 风险溢价',score:0.5,weight:20,contrib:function(){return this.score*this.weight/100*0.25}},
      {id:'估值10',name:'股债比价',score:-0.5,weight:40,contrib:function(){return this.score*this.weight/100*0.25}}
    ],
    aggregated: function(){
      var s=this.topics;var t=0;for(var i=0;i<s.length;i++)t+=s[i].score*s[i].weight;return (t/100);
    }
  },
  政策环境: {
    weight: 20,
    topics: [
      {id:'政策1',name:'大基金三期',score:2.5,weight:40,contrib:function(){return this.score*this.weight/100*0.20}},
      {id:'政策2',name:'AI 产业政策',score:2.5,weight:30,contrib:function(){return this.score*this.weight/100*0.20}},
      {id:'政策3',name:'货币宽松力度',score:2.5,weight:30,contrib:function(){return this.score*this.weight/100*0.20}}
    ],
    aggregated: function(){
      var s=this.topics;var t=0;for(var i=0;i<s.length;i++)t+=s[i].score*s[i].weight;return (t/100);
    }
  },
  资金流向: {
    weight: 15,
    topics: [
      {id:'资金5',name:'公募行业超低配',score:2.0,weight:40,contrib:function(){return this.score*this.weight/100*0.15}},
      {id:'资金4',name:'两融余额回升',score:1.5,weight:30,contrib:function(){return this.score*this.weight/100*0.15}},
      {id:'资金7',name:'北向资金流入',score:1.0,weight:25,contrib:function(){return this.score*this.weight/100*0.15}}
    ],
    aggregated: function(){
      var s=this.topics;var t=0;for(var i=0;i<s.length;i++)t+=s[i].score*s[i].weight;return (t/100);
    }
  },
  技术动量: {
    weight: 15,
    topics: [
      {id:'技术1',name:'均线系统',score:-1.0,weight:30,contrib:function(){return this.score*this.weight/100*0.15}},
      {id:'技术2',name:'MACD 底背离',score:1.0,weight:30,contrib:function(){return this.score*this.weight/100*0.15}},
      {id:'技术3',name:'ADX 趋势',score:0.0,weight:40,contrib:function(){return this.score*this.weight/100*0.15}}
    ],
    aggregated: function(){
      var s=this.topics;var t=0;for(var i=0;i<s.length;i++)t+=s[i].score*s[i].weight;return (t/100);
    }
  }
};

// Compute TAA total
function computeTAA(){
  var dims = ['宏观研判','市场估值','政策环境','资金流向','技术动量'];
  var total = 0;
  var breakdown = {};
  for(var i=0;i<dims.length;i++){
    var dim = MAPPING[dims[i]];
    var agg = dim.aggregated();
    var contrib = agg * dim.weight / 100;
    total += contrib;
    breakdown[dims[i]] = {aggregated:parseFloat(agg.toFixed(2)),weight:dim.weight,contribution:contrib,topics:dim.topics};
  }
  return {total:total.toFixed(2),breakdown:breakdown};
}

// Get all topics with their dimension mapping
function getAllTopics(){
  var all = [];
  var dims = ['宏观研判','市场估值','政策环境','资金流向','技术动量'];
  for(var i=0;i<dims.length;i++){
    var dim = MAPPING[dims[i]];
    for(var j=0;j<dim.topics.length;j++){
      var t = dim.topics[j];
      all.push({id:t.id,name:t.name,dimension:dims[i],dimWeight:dim.weight,score:t.score,topicWeight:t.weight});
    }
  }
  return all;
}

// Engine self-test
(function(){
  var result = computeTAA();
  console.log('TAA Total:', result.total);
  console.log('Expected:  0.85');
  console.log('Match:', Math.abs(parseFloat(result.total)-0.85) < 0.01 ? 'PASS' : 'FAIL');
})();
