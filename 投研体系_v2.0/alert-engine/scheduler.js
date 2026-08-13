/**
 * Alert Scheduler - 自动监控调度器
 * 每5分钟检查，页面隐藏时降频
 * @version 1.0.0
 */

const AlertScheduler = (function() {
  'use strict';

  var ACTIVE_INTERVAL = 5 * 60 * 1000;    // 5分钟（页面可见）
  var IDLE_INTERVAL = 15 * 60 * 1000;     // 15分钟（页面隐藏）
  var timerId = null;
  var currentInterval = ACTIVE_INTERVAL;
  var isRunning = false;
  var checkCount = 0;

  function getData() {
    // 优先从 DataPipeline 获取
    if (window.DataPipeline && DataPipeline.load) {
      var today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      return DataPipeline.load(today).then(function(r) {
        return r.data || r;
      }).catch(function() {
        // 降级：使用最近数据
        return {
          solvency: { comprehensive_ratio: 132, core_ratio: 118 },
          duration: { gap: 2.1 },
          risk: { liquidity_ratio: 0.05 },
          spread: { value: 70 }
        };
      });
    }
    // 无 DataPipeline，使用默认数据
    return Promise.resolve({
      solvency: { comprehensive_ratio: 132, core_ratio: 118 },
      duration: { gap: 2.1 },
      risk: { liquidity_ratio: 0.05 },
      spread: { value: 70 }
    });
  }

  async function runCheck() {
    checkCount++;
    try {
      var data = await getData();
      var alerts = AlertEngine.getTriggered(data);

      if (alerts.length > 0) {
        console.log('[Scheduler] 第' + checkCount + '次检查, 触发' + alerts.length + '条预警');
        alerts.forEach(function(alert) {
          AlertNotifier.notify(alert);
        });
      } else {
        console.log('[Scheduler] 第' + checkCount + '次检查, 无预警');
      }
    } catch (err) {
      console.error('[Scheduler] 检查失败:', err.message);
    }
  }

  function schedule() {
    if (timerId) clearInterval(timerId);
    timerId = setInterval(runCheck, currentInterval);
  }

  function start(interval) {
    if (interval) ACTIVE_INTERVAL = interval;
    if (isRunning) return;

    isRunning = true;
    currentInterval = ACTIVE_INTERVAL;
    console.log('[Scheduler] 启动, 间隔' + (ACTIVE_INTERVAL / 60000) + '分钟');

    // 立即执行一次
    runCheck();
    schedule();

    // 页面可见性监听
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        currentInterval = IDLE_INTERVAL;
        console.log('[Scheduler] 页面隐藏, 降频至' + (IDLE_INTERVAL / 60000) + '分钟');
        schedule();
      } else {
        currentInterval = ACTIVE_INTERVAL;
        console.log('[Scheduler] 页面可见, 恢复' + (ACTIVE_INTERVAL / 60000) + '分钟');
        schedule();
        // 可见时立即检查
        runCheck();
      }
    });
  }

  function stop() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    isRunning = false;
    console.log('[Scheduler] 已停止');
  }

  function getStatus() {
    return {
      running: isRunning,
      interval: currentInterval / 60000,
      check_count: checkCount
    };
  }

  return {
    start: start,
    stop: stop,
    runCheck: runCheck,
    getStatus: getStatus
  };
})();

/**
 * Test Alerts - 模拟预警测试
 */
const TestAlerts = (function() {
  'use strict';

  function trigger(ruleId) {
    var rule = AlertEngine.rules.find(function(r) { return r.id === ruleId; });
    if (!rule) {
      console.error('[TestAlerts] 未找到规则:', ruleId);
      return;
    }

    var testAlert = {
      id: ruleId + '-TEST-' + Date.now(),
      rule_id: ruleId,
      severity: rule.severity,
      category: rule.category,
      name: '[测试] ' + rule.name,
      message: rule.message.replace(/\{value\}/g, '--').replace(/\{change\}/g, '--'),
      timestamp: new Date().toISOString(),
      current_value: 'N/A',
      status: 'unread'
    };

    AlertNotifier.notify(testAlert);
    console.log('[TestAlerts] 已触发:', ruleId, testAlert.severity);
  }

  function triggerAll() {
    AlertEngine.rules.forEach(function(rule) {
      setTimeout(function() {
        trigger(rule.id);
      }, 500 * AlertEngine.rules.indexOf(rule));
    });
  }

  function clearAll() {
    AlertNotifier.clearAll();
    AlertHistory.clearAll();
    console.log('[TestAlerts] 已清除所有预警');
  }

  function listAll() {
    console.table(AlertEngine.rules.map(function(r) {
      return { id: r.id, name: r.name, severity: r.severity, category: r.category };
    }));
  }

  return {
    trigger: trigger,
    triggerAll: triggerAll,
    clear: clearAll,
    list: listAll
  };
})();

if (typeof window !== 'undefined') {
  window.AlertScheduler = AlertScheduler;
  window.TestAlerts = TestAlerts;
}
