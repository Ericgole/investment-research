/**
 * Alert Notifier - 预警通知系统
 * 三级严重度：banner + popup + sound + badge + log
 * @version 1.0.0
 */

const AlertNotifier = (function() {
  'use strict';

  // ============ 通知级别配置 ============
  const notifyLevels = {
    critical: { banner: true, popup: true,  sound: true,  badge: true,  log: true },
    warning:  { banner: true, popup: false, sound: false, badge: true,  log: true },
    info:     { banner: false,popup: false, sound: false, badge: false, log: true }
  };

  const severityColors = {
    critical: { bg: '#fee2e2', color: '#dc2626', border: '#ef4444', icon: '🔴' },
    warning:  { bg: '#fef3c7', color: '#d97706', border: '#f59e0b', icon: '🟡' },
    info:     { bg: '#dbeafe', color: '#2563eb', border: '#3b82f6', icon: '🔵' }
  };

  // ============ DOM 元素缓存 ============
  var bannerEl = null;
  var popupEl = null;
  var badgeEl = null;

  function ensureBanner() {
    if (bannerEl) return bannerEl;
    bannerEl = document.getElementById('alert-banner-top');
    if (!bannerEl) {
      bannerEl = document.createElement('div');
      bannerEl.id = 'alert-banner-top';
      bannerEl.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:1000;padding:12px 24px;text-align:center;font-weight:600;font-size:13px;display:none;cursor:pointer;font-family:-apple-system,BlinkMacSystemFont,"Microsoft YaHei",sans-serif';
      bannerEl.onclick = function() { hideBanner(); };
      document.body.insertBefore(bannerEl, document.body.firstChild);
    }
    return bannerEl;
  }

  function ensurePopup() {
    if (popupEl) return popupEl;
    popupEl = document.createElement('div');
    popupEl.id = 'alert-popup';
    popupEl.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:2000;display:none;align-items:center;justify-content:center';
    popupEl.innerHTML = '<div id="alert-popup-inner" style="background:#fff;border-radius:12px;padding:32px;max-width:480px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3)"></div>';
    document.body.appendChild(popupEl);
    return popupEl;
  }

  function ensureBadge() {
    if (badgeEl) return badgeEl;
    badgeEl = document.getElementById('alert-nav-badge');
    if (!badgeEl) {
      badgeEl = document.createElement('span');
      badgeEl.id = 'alert-nav-badge';
      badgeEl.style.cssText = 'display:none;position:absolute;top:-4px;right:-8px;background:#ef4444;color:#fff;border-radius:10px;min-width:18px;height:18px;line-height:18px;text-align:center;font-size:10px;font-weight:700;padding:0 5px';
      // 附加到导航的预警项
      var navItems = document.querySelectorAll('.nav-item');
      navItems.forEach(function(item) {
        if (item.textContent.includes('风险')) {
          item.style.position = 'relative';
          item.appendChild(badgeEl);
        }
      });
    }
    return badgeEl;
  }

  // ============ 提示音 ============
  var audioCtx = null;

  function playSound() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 800;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      // 音频不可用时静默
    }
  }

  // ============ Banner ============
  function showBanner(alert) {
    var banner = ensureBanner();
    var colors = severityColors[alert.severity] || severityColors.warning;
    banner.style.background = colors.bg;
    banner.style.color = colors.color;
    banner.style.borderBottom = '2px solid ' + colors.border;
    banner.textContent = colors.icon + ' ' + alert.name + ': ' + alert.message;
    banner.style.display = 'block';

    // 自动消失（critical 不自动消失）
    if (alert.severity !== 'critical') {
      setTimeout(function() {
        if (banner.textContent.indexOf(alert.name) >= 0) {
          hideBanner();
        }
      }, 10000);
    }
  }

  function hideBanner() {
    if (bannerEl) bannerEl.style.display = 'none';
  }

  // ============ Popup ============
  function showPopup(alert) {
    var popup = ensurePopup();
    var inner = document.getElementById('alert-popup-inner');
    var colors = severityColors[alert.severity];

    inner.innerHTML =
      '<div style="font-size:40px;margin-bottom:12px">' + colors.icon + '</div>' +
      '<h2 style="color:' + colors.color + ';margin-bottom:8px;font-size:18px">⚠ ' + alert.name + '</h2>' +
      '<p style="color:#64748b;font-size:13px;margin-bottom:20px;line-height:1.6">' + alert.message + '</p>' +
      '<div style="font-size:11px;color:#94a3b8;margin-bottom:16px">' +
        '严重级别: <b style="color:' + colors.color + '">' + alert.severity.toUpperCase() + '</b> | ' +
        '规则: ' + alert.rule_id + ' | ' +
        '时间: ' + new Date().toLocaleTimeString('zh-CN') +
      '</div>' +
      '<button id="alert-ack-btn" style="padding:10px 40px;background:' + colors.border + ';color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">我已确认</button>';

    popup.style.display = 'flex';

    document.getElementById('alert-ack-btn').onclick = function() {
      popup.style.display = 'none';
      if (window.AlertHistory) {
        AlertHistory.acknowledge(alert.id);
      }
    };
  }

  // ============ Badge ============
  var unreadCount = 0;

  function updateBadge() {
    var badge = ensureBadge();
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }

  // ============ 公共 API ============

  function notify(alert) {
    var config = notifyLevels[alert.severity] || notifyLevels.info;

    // 生成唯一ID
    alert.id = alert.rule_id + '-' + new Date().toISOString().slice(0,16).replace(/[-:T]/g,'');
    alert.timestamp = new Date().toISOString();
    alert.status = 'unread';

    // 横幅通知
    if (config.banner) {
      showBanner(alert);
    }

    // 弹窗（critical）
    if (config.popup) {
      showPopup(alert);
    }

    // 提示音
    if (config.sound) {
      playSound();
    }

    // 角标
    if (config.badge) {
      unreadCount++;
      updateBadge();
    }

    // 写入历史
    if (config.log && window.AlertHistory) {
      AlertHistory.add(alert);
    }

    console.log('[Alert] ' + alert.severity.toUpperCase() + ' | ' + alert.name + ' | ' + alert.message);
    return alert;
  }

  /**
   * 清除所有通知UI
   */
  function clearAll() {
    hideBanner();
    if (popupEl) popupEl.style.display = 'none';
    unreadCount = 0;
    updateBadge();
  }

  return {
    notify: notify,
    showBanner: showBanner,
    hideBanner: hideBanner,
    showPopup: showPopup,
    clearAll: clearAll,
    getUnreadCount: function() { return unreadCount; },
    resetBadge: function() { unreadCount = 0; updateBadge(); }
  };
})();

if (typeof window !== 'undefined') {
  window.AlertNotifier = AlertNotifier;
}
