/**
 * importer.js — 持仓数据导入（内部持仓 · 模块一）
 *
 * 职责：解析 Excel(.xlsx)/CSV/JSON → 字段校验 → 按账户隔离写入 localStorage
 * 特性：增量导入（重复代码默认跳过，可显式覆盖）；纯逻辑与存储解耦，便于单测
 */
(function (global) {
  'use strict';

  /* ============================================================
   * 一、常量
   * ============================================================ */
  const REQUIRED_FIELDS = [
    'account_type', 'security_code', 'security_name', 'asset_class',
    'quantity', 'cost_price', 'market_price', 'market_value', 'nav_date',
  ];
  const NUMERIC_FIELDS = ['quantity', 'cost_price', 'market_price', 'market_value'];
  const VALID_ACCOUNTS = ['普通', '分红', '万能'];
  const VALID_ASSET_CLASS = ['权益', '固收', '另类', '现金'];
  const KEY_PREFIX = 'portfolio.data.';
  const KEY_CURRENT = 'portfolio.current';

  /* ============================================================
   * 二、纯解析（无 localStorage 依赖，可单测）
   * ============================================================ */
  function stripBOM(text) {
    return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  }

  function parseCSV(text) {
    text = stripBOM(text);
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lines.length === 0) return [];
    const header = lines[0].split(',').map((h) => h.trim());
    return lines.slice(1).map((line) => {
      // 简单逗号切分（导入模板不含引号转义，够用）
      const vals = line.split(',');
      const obj = {};
      header.forEach((h, i) => { obj[h] = (vals[i] === undefined ? '' : vals[i]).trim(); });
      return obj;
    });
  }

  function parseJSON(text) {
    const data = JSON.parse(text);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.holdings)) return data.holdings;
    if (data && Array.isArray(data.data)) return data.data;
    throw new Error('JSON 结构无法识别，应为数组或含 holdings/data 数组的对象');
  }

  async function parseXLSX(arrayBuffer) {
    const XLSX = global.XLSX;
    if (!XLSX) throw new Error('SheetJS 未加载（离线），请改用 CSV/JSON 格式');
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheet = wb.Sheets[wb.SheetNames[0]];
    if (!firstSheet) throw new Error('Excel 无工作表');
    return XLSX.utils.sheet_to_json(firstSheet);
  }

  /* ============================================================
   * 三、字段校验（纯函数）
   * ============================================================ */
  function validateRow(row, lineNo) {
    const errors = [];
    for (const f of REQUIRED_FIELDS) {
      if (row[f] === undefined || row[f] === null || String(row[f]).trim() === '') {
        errors.push(`第 ${lineNo} 行缺失字段「${f}」`);
      }
    }
    for (const f of NUMERIC_FIELDS) {
      const v = row[f];
      if (v !== undefined && v !== null && String(v).trim() !== '' && isNaN(Number(v))) {
        errors.push(`第 ${lineNo} 行字段「${f}」格式错误：${v}（应为数字）`);
      }
    }
    if (row.account_type && !VALID_ACCOUNTS.includes(row.account_type)) {
      errors.push(`第 ${lineNo} 行账户类型「${row.account_type}」无效（应为 普通/分红/万能）`);
    }
    if (row.asset_class && !VALID_ASSET_CLASS.includes(row.asset_class)) {
      errors.push(`第 ${lineNo} 行资产类别「${row.asset_class}」无效（应为 权益/固收/另类/现金）`);
    }
    return errors;
  }

  function validateRows(rows) {
    const errors = [];
    rows.forEach((row, i) => {
      errors.push(...validateRow(row, i + 2)); // 第 1 行是表头
    });
    return errors;
  }

  /* ============================================================
   * 四、标准化（纯函数）
   * ============================================================ */
  function normalizeRow(row, targetAccount) {
    const qty = Number(row.quantity);
    const mkt = Number(row.market_price);
    const out = {
      account_type: (row.account_type || '').trim() || targetAccount,
      security_code: String(row.security_code).trim(),
      security_name: String(row.security_name).trim(),
      asset_class: String(row.asset_class).trim(),
      quantity: qty,
      cost_price: Number(row.cost_price),
      market_price: mkt,
      // market_value 缺省时按 数量 × 市价 自动计算
      market_value: (row.market_value !== undefined && String(row.market_value).trim() !== '')
        ? Number(row.market_value)
        : +(qty * mkt).toFixed(2),
      nav_date: String(row.nav_date).trim(),
    };
    return out;
  }

  /* ============================================================
   * 五、增量合并（纯函数，返回结果对象）
   * ============================================================ */
  function mergeRows(existing, rows, overwrite, targetAccount) {
    const normalized = rows.map((r) => normalizeRow(r, targetAccount));
    const codeIndex = new Map();
    existing.forEach((h, i) => codeIndex.set(h.security_code, i));

    const added = [];
    const duplicates = [];
    const merged = existing.slice();

    for (const row of normalized) {
      const idx = codeIndex.get(row.security_code);
      if (idx !== undefined) {
        if (overwrite) {
          merged[idx] = row;
          duplicates.push({ code: row.security_code, name: row.security_name, action: '覆盖' });
        } else {
          duplicates.push({ code: row.security_code, name: row.security_name, action: '跳过' });
        }
      } else {
        merged.push(row);
        codeIndex.set(row.security_code, merged.length - 1);
        added.push(row);
      }
    }
    return { merged, added, duplicates };
  }

  /* ============================================================
   * 六、存储层（localStorage，按账户隔离）
   * ============================================================ */
  function storage() {
    if (typeof localStorage !== 'undefined') return localStorage;
    // 无 localStorage 环境（如 node 单测）返回内存兜底
    if (!storage._mem) storage._mem = {};
    return {
      getItem: (k) => (k in storage._mem ? storage._mem[k] : null),
      setItem: (k, v) => { storage._mem[k] = String(v); },
      removeItem: (k) => { delete storage._mem[k]; },
    };
  }

  function getHoldings(account) {
    const raw = storage().getItem(KEY_PREFIX + account);
    try { return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
  }
  function setHoldings(account, holdings) {
    storage().setItem(KEY_PREFIX + account, JSON.stringify(holdings));
  }
  function getCurrentAccount() {
    return storage().getItem(KEY_CURRENT) || '普通';
  }
  function setCurrentAccount(account) {
    storage().setItem(KEY_CURRENT, account);
  }

  /* ============================================================
   * 七、高层导入入口
   * ============================================================ */
  async function importFile(file, targetAccount, overwrite) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    let rows;
    if (ext === 'csv') {
      rows = parseCSV(await file.text());
    } else if (ext === 'json') {
      rows = parseJSON(await file.text());
    } else if (ext === 'xlsx' || ext === 'xls') {
      rows = await parseXLSX(await file.arrayBuffer());
    } else {
      throw new Error(`不支持的文件格式：.${ext}（支持 xlsx/csv/json）`);
    }

    if (!rows || rows.length === 0) throw new Error('文件为空或无数据行');

    // 字段校验
    const errors = validateRows(rows);
    const validRows = rows.filter((r, i) => validateRow(r, i + 2).length === 0);
    if (validRows.length === 0) {
      return { success: false, imported: 0, errors, duplicates: [] };
    }

    // 合并（增量）
    const existing = getHoldings(targetAccount);
    const result = mergeRows(existing, validRows, overwrite, targetAccount);
    setHoldings(targetAccount, result.merged);

    return {
      success: true,
      imported: result.added.length,
      duplicates: result.duplicates,
      errors,
      total: result.merged.length,
    };
  }

  global.PortfolioImporter = {
    REQUIRED_FIELDS, NUMERIC_FIELDS, VALID_ACCOUNTS, VALID_ASSET_CLASS,
    parseCSV, parseJSON, parseXLSX,
    validateRow, validateRows, normalizeRow, mergeRows,
    getHoldings, setHoldings, getCurrentAccount, setCurrentAccount,
    importFile,
  };
})(window);
