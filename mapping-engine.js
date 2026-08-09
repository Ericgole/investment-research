// ===== 投研体系 v2.0 · 透明映射引擎 =====
// 专题 → 五维聚合 → TAA 加权总分
// 每个计算步骤均可追溯: 哪个专题贡献了多少分

var MAPPING = {
  // 每个 TAA 维度下挂的专题及其权重、当前评分、贡献度
  宏观研判: {
    weight: 30,
    topics: [
      {id:'宏观1',name:'GDP 季度分解',score:-0.5,weight:25,contrib:function(){return this.score*this.weight/100*0.30}},
      {id:'宏观2',name:'PMI 分项解读',score:-0.5,weight:25,contrib:function(){return this.score*this.weight/100*0.30}},
      {id:'宏观8',name:'M1-M2 剪刀差',score:-1,weight:20,contrib:function(){return this.score*this.weight/100*0.30}},
      {id:'宏观14',name:'流动性 DR007',score:1,weight:15,contrib:function(){return this.score*this.weight/100*0.30}},
      {id:'宏观15',name:'美元周期',score:1,weight:15,contrib:function(){return this.score*this.weight/100*0.30}}
    ],
    aggregated: function(){
      var s=this.topics;var t=0;for(var i=0;i<s.length;i++)t+=s[i].score*s[i].weight;return (t/100).toFixed(1);
    }
  },
  市场估值: {
    weight: 30,
    topics: [
      {id:'估值1',name:'PE/PB 历史分位',score:-1,weight:40,contrib:function(){return this.score*this.weight/100*0.30}},
      {id:'估值5',name:'ERP 风险溢价',score:0.5,weight:25,contrib:function(){return this.score*this.weight/100*0.30}},
      {id:'估值10',name:'股债比价',score:1,weight:20,contrib:function(){return this.score*this.weight/100*0.30}},
      {id:'估值2',name:'行业估值对比',score:-1,weight:15,contrib:function(){return this.score*this.weight/100*0.30}}
    ],
    aggregated: function(){
      var s=this.topics;var t=0;for(var i=0;i<s.length;i++)t+=s[i].score*s[i].weight;return (t/100).toFixed(1);
    }
  },
  政策环境: {
    weight: 20,
    topics: [
      {id:'政策1',name:'大基金三期',score:2,weight:50,contrib:function(){return this.score*this.weight/100*0.20}},
      {id:'政策2',name:'AI 产业政策',score:2,weight:30,contrib:function(){return this.score*this.weight/100*0.20}},
      {id:'政策3',name:'货币宽松力度',score:2,weight:20,contrib:function(){return this.score*this.weight/100*0.20}}
    ],
    aggregated: function(){
      var s=this.topics;var t=0;for(var i=0;i<s.length;i++)t+=s[i].score*s[i].weight;return (t/100).toFixed(1);
    }
  },
  资金流向: {
    weight: 15,
    topics: [
      {id:'资金5',name:'公募行业超低配',score:1,weight:40,contrib:function(){return this.score*this.weight/100*0.15}},
      {id:'资金4',name:'公募仓位监测',score:-0.5,weight:30,contrib:function(){return this.score*this.weight/100*0.15}},
      {id:'资金7',name:'两融余额',score:0.5,weight:30,contrib:function(){return this.score*this.weight/100*0.15}}
    ],
    aggregated: function(){
      var s=this.topics;var t=0;for(var i=0;i<s.length;i++)t+=s[i].score*s[i].weight;return (t/100).toFixed(1);
    }
  },
  技术动量: {
    weight: 5,
    topics: [
      {id:'技术1',name:'均线系统',score:-1,weight:40,contrib:function(){return this.score*this.weight/100*0.05}},
      {id:'技术2',name:'MACD',score:0.5,weight:30,contrib:function(){return this.score*this.weight/100*0.05}},
      {id:'技术3',name:'ADX 趋势',score:0,weight:30,contrib:function(){return this.score*this.weight/100*0.05}}
    ],
    aggregated: function(){
      var s=this.topics;var t=0;for(var i=0;i<s.length;i++)t+=s[i].score*s[i].weight;return (t/100).toFixed(1);
    }
  }
};

// Compute TAA total
function computeTAA(){
  var dims = ['宏观研判','市场估值','政策环境','资金流向','技术动量'];
  var weights = [30,30,20,15,5];
  var total = 0;
  var breakdown = {};
  for(var i=0;i<dims.length;i++){
    var dim = MAPPING[dims[i]];
    var agg = parseFloat(dim.aggregated());
    var contrib = agg * weights[i] / 100;
    total += contrib;
    breakdown[dims[i]] = {aggregated:agg,weight:weights[i],contribution:contrib,topics:dim.topics};
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
  console.log('Match:', Math.abs(parseFloat(result.total)-0.85) < 0.05 ? 'PASS' : 'FAIL');
})();
