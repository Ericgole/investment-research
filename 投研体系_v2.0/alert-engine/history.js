/**
 * Alert History - 预警历史记录
 * localStorage 存储，保留90天
 * @version 1.0.0
 */

const AlertHistory = (function() {
  'use strict';

  var STORAGE_KEY = 'alert_history';
  var RETENTION_DAYS = 90;

  function getStore() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveStore(alerts) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
    } catch (e) {
      console.warn('[AlertHistory] localStorage 存储失败:', e.message);
      // 清理旧数据腾空间
      var trimmed = alerts.slice(-500);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    }
  }

  function cleanup() {
    var alerts = getStore();
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
    return alerts.filter(function(a) {
      return new Date(a.timestamp) > cutoff;
    });
  }

  // ============ 公共 API ============

  function add(alert) {
    var alerts = getStore();
    alerts.push({
      id: alert.id,
      rule_id: alert.rule_id,
      severity: alert.severity,
      category: alert.category || '',
      name: alert.name,
      message: alert.message,
      timestamp: alert.timestamp || new Date().toISOString(),
      current_value: alert.current_value,
      status: 'unread',
      acknowledged_by: null,
      acknowledged_at: null
    });
    saveStore(cleanup().concat(alerts.slice(-200)));
  }

  function acknowledge(alertId) {
    var alerts = getStore();
    var found = false;
    alerts = alerts.map(function(a) {
      if (a.id === alertId) {
        found = true;
        a.status = 'acknowledged';
        a.acknowledged_at = new Date().toISOString();
      }
      return a;
    });
    if (found) saveStore(alerts);
    return found;
  }

  function markAllRead() {
    var alerts = getStore();
    alerts = alerts.map(function(a) {
      if (a.status === 'unread') a.status = 'read';
      return a;
    });
    saveStore(alerts);
  }

  function getRecent(days) {
    var alerts = getStore();
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (days || 7));
    return alerts.filter(function(a) {
      return new Date(a.timestamp) > cutoff;
    }).sort(function(a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
  }

  function getByRule(ruleId) {
    return getStore().filter(function(a) {
      return a.rule_id === ruleId;
    }).sort(function(a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
  }

  function getBySeverity(level) {
    return getStore().filter(function(a) {
      return a.severity === level;
    }).sort(function(a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
  }

  function getUnread() {
    return getStore().filter(function(a) {
      return a.status === 'unread';
    }).sort(function(a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
  }

  function statistics() {
    var alerts = getStore();
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    function inRange(a, start) {
      return new Date(a.timestamp) >= start;
    }

    return {
      today: alerts.filter(function(a) { return inRange(a, today); }).length,
      week: alerts.filter(function(a) { return inRange(a, weekStart); }).length,
      month: alerts.filter(function(a) { return inRange(a, monthStart); }).length,
      total: alerts.length,
      unread: alerts.filter(function(a) { return a.status === 'unread'; }).length,
      critical: alerts.filter(function(a) { return a.severity === 'critical'; }).length,
      warning: alerts.filter(function(a) { return a.severity === 'warning'; }).length,
      info: alerts.filter(function(a) { return a.severity === 'info'; }).length
    };
  }

  function clearAll() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function getAll() {
    return getStore().sort(function(a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
  }

  return {
    add: add,
    acknowledge: acknowledge,
    markAllRead: markAllRead,
    getRecent: getRecent,
    getByRule: getByRule,
    getBySeverity: getBySeverity,
    getUnread: getUnread,
    statistics: statistics,
    getAll: getAll,
    clearAll: clearAll,
    STORAGE_KEY: STORAGE_KEY,
    RETENTION_DAYS: RETENTION_DAYS
  };
})();

if (typeof window !== 'undefined') {
  window.AlertHistory = AlertHistory;
}
