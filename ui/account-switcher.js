/**
 * account-switcher.js — 多账户切换器（内部持仓 · 模块二）
 *
 * 职责：导航栏右侧账户下拉框，切换后广播刷新；当前高亮、未选置灰；localStorage 隔离
 */
(function (global) {
  'use strict';

  const ACCOUNTS = [
    { key: '普通', icon: '🏛️', desc: '传统寿险资金' },
    { key: '分红', icon: '💰', desc: '分红险资金' },
    { key: '万能', icon: '🔄', desc: '万能险资金' },
  ];

  let current = '普通';
  let onChangeCallback = null;
  let containerEl = null;

  /* ============================================================
   * 初始化：渲染下拉框 + 恢复当前账户
   * ============================================================ */
  function init(container, opts) {
    opts = opts || {};
    containerEl = container;
    if (typeof PortfolioImporter !== 'undefined' && PortfolioImporter.getCurrentAccount) {
      current = PortfolioImporter.getCurrentAccount();
    }
    render();
    bindEvents();
    return current;
  }

  function render() {
    if (!containerEl) return;
    const cur = ACCOUNTS.find((a) => a.key === current) || ACCOUNTS[0];
    containerEl.innerHTML =
      `<button class="acct-btn" type="button" aria-haspopup="listbox" aria-expanded="false">
        <span class="acct-icon">${cur.icon}</span>
        <span class="acct-name">${cur.key}账户</span>
        <span class="acct-caret">▼</span>
      </button>
      <div class="acct-menu" role="listbox">
        ${ACCOUNTS.map((a) => `
          <div class="acct-item ${a.key === current ? 'active' : ''}" data-account="${a.key}" role="option" aria-selected="${a.key === current}">
            <span class="acct-icon">${a.icon}</span>
            <span class="acct-item-name">${a.key}账户</span>
            <span class="acct-item-desc">${a.desc}</span>
            ${a.key === current ? '<span class="acct-check">✓</span>' : ''}
          </div>`).join('')}
      </div>`;
  }

  function bindEvents() {
    if (!containerEl) return;
    const btn = containerEl.querySelector('.acct-btn');
    const menu = containerEl.querySelector('.acct-menu');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.classList.toggle('show');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    containerEl.querySelectorAll('.acct-item').forEach((item) => {
      item.addEventListener('click', () => {
        setAccount(item.getAttribute('data-account'));
        menu.classList.remove('show');
        btn.setAttribute('aria-expanded', 'false');
      });
    });

    // 点击外部关闭
    document.addEventListener('click', () => {
      menu.classList.remove('show');
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  /* ============================================================
   * 切换账户
   * ============================================================ */
  function setAccount(key) {
    if (!ACCOUNTS.some((a) => a.key === key)) return;
    if (key === current) return;
    current = key;
    if (typeof PortfolioImporter !== 'undefined' && PortfolioImporter.setCurrentAccount) {
      PortfolioImporter.setCurrentAccount(key);
    }
    render();
    bindEvents();
    if (onChangeCallback) onChangeCallback(key);
  }

  function getCurrent() { return current; }
  function onChange(cb) { onChangeCallback = cb; }

  global.AccountSwitcher = { ACCOUNTS, init, render, setAccount, getCurrent, onChange };
})(window);
