-- ============================================================
-- 投研体系 v2.0 数据库 Schema (SQLite)
-- 12张核心表：仪表盘/SAA/工作流/管道/预警/报告/选品/风控/归因
-- Generated: 2026-08-10
-- ============================================================

-- 1. dashboard_kpi: 仪表盘KPI快照
CREATE TABLE dashboard_kpi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_time DATETIME NOT NULL DEFAULT (datetime('now')),
    solvency_ratio REAL NOT NULL,          -- 偿付能力充足率 %
    taa_weighted_score REAL NOT NULL,       -- TAA五维加权分
    portfolio_return REAL NOT NULL,         -- 组合预期年化收益 %
    portfolio_volatility REAL NOT NULL,     -- 组合年化波动 %
    duration_gap REAL NOT NULL,             -- 久期缺口 年
    var_99_10d REAL NOT NULL,               -- VaR(99%,10日) %
    equity_ratio REAL NOT NULL,             -- 权益总仓位 %
    liability_coverage REAL NOT NULL,       -- 负债成本覆盖率 x
    alert_count INTEGER DEFAULT 0          -- 当前活跃预警数
);
CREATE INDEX idx_kpi_time ON dashboard_kpi(snapshot_time);

-- 2. saa_allocation: SAA战略配置中枢
CREATE TABLE saa_allocation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    valid_from DATE NOT NULL,
    valid_to DATE,
    asset_class TEXT NOT NULL,              -- 资产类别
    ticker TEXT,                            -- 产品代码 e.g. sh518880
    product_name TEXT,                      -- 产品名称
    weight_pct REAL NOT NULL,               -- 配置权重 %
    expected_return REAL,                   -- 预期年化收益 %
    annual_volatility REAL,                 -- 年化波动 %
    sharpe_ratio REAL,                      -- 夏普比率
    max_drawdown REAL,                      -- 最大回撤 %
    corr_with_hs300 REAL,                   -- 与沪深300相关系数
    liability_coverage REAL,                -- 负债覆盖率 x
    ifrs17_category TEXT,                   -- IFRS17分类 AC/FVOCI/FVTPL
    status TEXT DEFAULT 'active'            -- active/archived
);
CREATE INDEX idx_saa_asset ON saa_allocation(asset_class, status);

-- 3. taa_scorecard: TAA五维评分明细 (历史)
CREATE TABLE taa_scorecard (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eval_date DATE NOT NULL,
    dimension TEXT NOT NULL,                -- 宏观/估值/技术/资金/政策
    weight REAL NOT NULL,                   -- 维度权重
    score REAL NOT NULL,                    -- 评分 [-3,+3]
    rationale TEXT,                         -- 评分理由
    key_indicators TEXT                     -- 关键指标JSON
);
CREATE INDEX idx_taa_date ON taa_scorecard(eval_date, dimension);

-- 4. workflow_deviation: TAA偏离审批工作流 (7步)
CREATE TABLE workflow_deviation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trigger_time DATETIME NOT NULL DEFAULT (datetime('now')),
    trigger_reason TEXT NOT NULL,           -- 触发原因
    taa_score REAL NOT NULL,                -- 触发时TAA评分
    deviation_plan TEXT,                    -- 偏离方案JSON
    current_step INTEGER DEFAULT 1,         -- 当前步骤 1-7
    step_status TEXT DEFAULT 'pending',     -- 每一步状态JSON
    precheck_result TEXT,                   -- 自动预检结果JSON
    approver TEXT,                          -- 审批人
    final_decision TEXT,                    -- 最终决策
    execute_time DATETIME,                  -- 执行时间
    post_review TEXT,                       -- 事后复盘
    status TEXT DEFAULT 'active'            -- active/done/cancelled
);
CREATE INDEX idx_workflow_status ON workflow_deviation(status, current_step);

-- 5. data_pipeline_log: ETL数据管道执行日志
CREATE TABLE data_pipeline_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL UNIQUE,            -- 管道运行ID
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    stage TEXT NOT NULL,                    -- collect/validate/etl/compute/deploy
    status TEXT NOT NULL,                   -- running/success/failed/rollback
    duration_ms INTEGER,                    -- 耗时毫秒
    records_processed INTEGER,
    records_failed INTEGER,
    error_message TEXT,                     -- 错误信息
    rollback_to TEXT,                       -- 回退到哪个版本
    created_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX idx_pipeline_run ON data_pipeline_log(run_id, stage);
CREATE INDEX idx_pipeline_time ON data_pipeline_log(start_time);

-- 6. data_lineage: 数据血缘追踪
CREATE TABLE data_lineage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_system TEXT NOT NULL,            -- westock/wind/sqlite/neodata
    indicator_name TEXT NOT NULL,           -- 指标名称
    downstream_modules TEXT,               -- 下游模块列表JSON
    last_refresh DATETIME,                 -- 最近刷新时间
    freshness_hours INTEGER,               -- 新鲜度(小时)
    status TEXT DEFAULT 'ok',              -- ok/stale/expired
    alert_triggered INTEGER DEFAULT 0     -- 是否触发告警
);
CREATE INDEX idx_lineage_source ON data_lineage(source_system);

-- 7. alert_rules: 预警规则配置
CREATE TABLE alert_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_name TEXT NOT NULL UNIQUE,         -- 规则名称
    category TEXT NOT NULL,                 -- market/credit/liquidity/operational/data
    trigger_condition TEXT NOT NULL,        -- 触发条件表达式
    severity TEXT NOT NULL,                 -- severe/warning/info
    current_value TEXT,                     -- 当前监测值
    status TEXT DEFAULT 'active',           -- active/monitoring/triggered
    last_triggered DATETIME,               -- 上次触发时间
    notify_channel TEXT,                    -- 通知渠道 feishu/dashboard/both
    cooldown_minutes INTEGER DEFAULT 60    -- 冷却时间(分钟)
);

-- 8. alert_history: 预警历史记录
CREATE TABLE alert_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id INTEGER NOT NULL,
    trigger_time DATETIME NOT NULL DEFAULT (datetime('now')),
    trigger_value TEXT NOT NULL,
    message TEXT NOT NULL,
    notify_result TEXT,                     -- 通知结果 sent/failed/pending
    acknowledged INTEGER DEFAULT 0,        -- 是否确认
    ack_time DATETIME,                     -- 确认时间
    resolved INTEGER DEFAULT 0,            -- 是否解决
    FOREIGN KEY (rule_id) REFERENCES alert_rules(id)
);
CREATE INDEX idx_alert_time ON alert_history(trigger_time);

-- 9. report_templates: 报告模板配置
CREATE TABLE report_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_type TEXT NOT NULL,              -- daily/weekly/monthly
    template_name TEXT NOT NULL,            -- 模板名称
    template_version TEXT NOT NULL,         -- 版本号
    schedule_cron TEXT,                     -- 调度cron表达式
    output_formats TEXT DEFAULT '["html","md","pdf"]',  -- 输出格式JSON
    push_channel TEXT DEFAULT 'dashboard',  -- 推送渠道
    variables_json TEXT,                    -- 模板变量定义JSON
    last_generated DATETIME,               -- 上次生成时间
    status TEXT DEFAULT 'active'
);

-- 10. report_history: 报告生成历史
CREATE TABLE report_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    generated_at DATETIME NOT NULL DEFAULT (datetime('now')),
    report_date DATE NOT NULL,              -- 报告日期
    report_type TEXT NOT NULL,              -- daily/weekly/monthly
    output_format TEXT NOT NULL,            -- html/md/pdf
    file_path TEXT,                         -- 文件路径
    generation_duration_ms INTEGER,         -- 生成耗时
    status TEXT DEFAULT 'success',          -- success/failed
    error_message TEXT,
    FOREIGN KEY (template_id) REFERENCES report_templates(id)
);
CREATE INDEX idx_report_date ON report_history(report_date, report_type);

-- 11. security_selection: 标的选品清单
CREATE TABLE security_selection (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_class TEXT NOT NULL,
    product_name TEXT NOT NULL,
    ticker TEXT NOT NULL,
    weight_pct REAL NOT NULL,
    fee_rate REAL,                          -- 费率 %
    amount_per_million REAL,                -- 每百万配置金额
    notes TEXT,
    list_date DATE,                         -- 入池日期
    status TEXT DEFAULT 'active'            -- active/removed
);

-- 12. risk_compliance: 风险限额合规检查
CREATE TABLE risk_compliance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    check_date DATE NOT NULL DEFAULT (date('now')),
    metric_name TEXT NOT NULL,              -- 指标名
    current_value REAL NOT NULL,
    limit_value REAL NOT NULL,              -- 限额
    unit TEXT,                              -- 单位
    status TEXT NOT NULL,                   -- compliant/breach/warning
    margin_pct REAL                         -- 距限额余量 %
);
CREATE INDEX idx_risk_date ON risk_compliance(check_date);

-- ============================================================
-- 初始化数据: 基准配置 2026-08-10
-- ============================================================

-- SAA配置初始化
INSERT INTO saa_allocation (valid_from, asset_class, ticker, product_name, weight_pct, expected_return, annual_volatility, sharpe_ratio, max_drawdown, corr_with_hs300, liability_coverage, ifrs17_category)
VALUES
('2026-08-08', '信用债', 'sh511110', '公司债ETF易方达', 27, 2.5, 4.7, NULL, 9.4, 0.05, 0.71, 'AC'),
('2026-08-08', '标普500', 'sh513500', '标普500ETF博时', 23, 13.0, 17.1, 0.58, 33.9, 0.14, 3.71, 'FVTPL'),
('2026-08-08', '黄金', 'sh518880', '黄金ETF华安', 21, 16.7, 16.0, 0.80, 25.0, -0.05, 4.77, 'FVOCI'),
('2026-08-08', '创业板', 'sz159915', '创业板ETF易方达', 9, 13.0, 30.9, 0.32, 69.7, 0.75, 3.71, 'FVTPL'),
('2026-08-08', '利率债', 'sh511010', '国债ETF国泰', 9, 1.9, 3.6, NULL, 7.2, 0.05, 0.54, 'AC'),
('2026-08-08', '沪深300', 'sh510310', '沪深300ETF易方达', 3, 4.1, 21.5, 0.05, 46.7, 1.00, 1.17, 'FVOCI'),
('2026-08-08', '科创50', 'sh588080', '科创50ETF易方达', 2, 14.1, 33.8, 0.33, 62.7, 0.72, 4.03, 'FVTPL'),
('2026-08-08', '现金', 'sh511360', '短融ETF海富通', 6, 3.0, 0.5, NULL, 0, 0.0, 0.86, 'AC');

-- TAA评分初始化
INSERT INTO taa_scorecard (eval_date, dimension, weight, score, rationale)
VALUES
('2026-08-10', '宏观', 0.25, 1.0, '内需偏弱但低利率+弱美元对冲'),
('2026-08-10', '估值', 0.25, -0.5, 'PE 5Y分位87%偏高,但ERP 5.3%仍有吸引力'),
('2026-08-10', '技术', 0.15, 0.0, '均线缠绕+RSI中性,缺乏方向'),
('2026-08-10', '资金', 0.15, 1.5, '公募超配科技+19.3%,两融稳定'),
('2026-08-10', '政策', 0.20, 2.5, '大基金三期3440亿+AI政策+科创再贷款1.2万亿');

-- 预警规则初始化 (10条)
INSERT INTO alert_rules (rule_name, category, trigger_condition, severity, status, notify_channel)
VALUES
('信用利差异常', 'data', 'AA-AAA利差>50bp或数据断流>5天', 'severe', 'triggered', 'feishu+dashboard'),
('TAA调整线突破', 'market', '五维加权突破±0.75', 'warning', 'triggered', 'feishu+dashboard'),
('权益仓位告警', 'market', '权益仓位>56%', 'warning', 'triggered', 'feishu'),
('PE分位偏高', 'market', '沪深300 PE 5Y分位>85%持续3天', 'info', 'monitoring', 'dashboard'),
('组合回撤预警', 'market', '5日滚动回撤>5%', 'warning', 'active', 'feishu'),
('VaR超限', 'market', 'VaR(99%,10日)>8%', 'severe', 'active', 'feishu+dashboard'),
('QDII汇率敞口', 'market', '境外敞口>20%且CNY升值>2%/月', 'warning', 'monitoring', 'dashboard'),
('黄金超涨预警', 'market', '黄金30日涨幅>15%', 'warning', 'active', 'feishu'),
('标普500回撤', 'market', '标普500 10日回撤>10%', 'warning', 'active', 'feishu'),
('M2-M1剪刀差', 'market', '剪刀差<-3.5pp持续2月', 'info', 'monitoring', 'dashboard');

-- 数据血缘初始化
INSERT INTO data_lineage (source_system, indicator_name, downstream_modules, last_refresh, freshness_hours, status)
VALUES
('westock-data', '指数行情OHLCV', '["CMA","TAA","风险看板","专题"]', '2026-08-08 15:30', 24, 'ok'),
('SQLite', '技术指标计算', '["TAA技术维度","专题"]', '2026-08-08 18:30', 48, 'ok'),
('Wind EDB', 'PMI/GDP/CPI/社融', '["宏观研判","周期定位"]', '2026-08-05 09:00', 120, 'stale'),
('Wind index_data', 'PE/PB历史分位', '["TAA估值维度","SAA CMA"]', '2026-08-07 15:30', 72, 'stale'),
('Wind bond_data', '信用利差序列', '["SAA负债覆盖率","利差分析"]', '2026-08-03 16:00', 168, 'expired'),
('SQLite research_db', '专题数据(24项)', '["全部73个专题"]', '2026-08-08 18:30', 24, 'ok');

-- 报告模板初始化
INSERT INTO report_templates (report_type, template_name, template_version, schedule_cron, output_formats, push_channel)
VALUES
('daily', '投研日报', 'v3.2', '0 30 6 * * *', '["html","md","pdf"]', 'feishu+dashboard'),
('weekly', '风险周报', 'v2.1', '0 30 6 * * 1', '["html","md"]', 'feishu'),
('monthly', '月度复盘', 'v2.0', '0 30 6 1 * *', '["html","pdf"]', 'dashboard');

-- 风险合规初始化
INSERT INTO risk_compliance (check_date, metric_name, current_value, limit_value, unit, status, margin_pct)
VALUES
('2026-08-10', '权益总仓位', 58, 60, '%', 'compliant', 3.3),
('2026-08-10', '组合波动率', 7.8, 20, '%', 'compliant', 61.0),
('2026-08-10', '最大回撤(估)', 15, 30, '%', 'compliant', 50.0),
('2026-08-10', '单一标的上限', 27, 35, '%', 'compliant', 22.9),
('2026-08-10', '高流动性占比', 42, 15, '%', 'compliant', 180.0),
('2026-08-10', 'VaR(99%,10d)', 4.82, 8, '%', 'compliant', 39.8);
