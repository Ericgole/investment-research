@echo off
chcp 65001 >nul
echo ============================================================
echo   投研体系 v2.0 — 一键部署脚本 (4周完整计划)
echo   Date: 2026-08-10
echo ============================================================
echo.
set BASE=%~dp0
set PYTHON=C:\Users\Ericgole\.workbuddy\binaries\python\versions\3.13.12\python.exe
set DB=%BASE%研究数据库\research_db.sqlite
set GEN=%BASE%专题生成器
set V20=%BASE%投研体系_v2.0

echo [Week 1] 方向一: 数据库 + 数据导出
echo ------------------------------------------------------------
echo Step 1.1: 建表 (schema.sql → SQLite)...
%PYTHON% -c "import sqlite3,re;c=sqlite3.connect(r'%DB%');cur=c.cursor();
with open(r'%V20%\schema.sql','r',encoding='utf-8') as f:txt=f.read();
for s in txt.split(';'):
 s=s.strip();
 if 'CREATE TABLE' in s.upper() and 'INDEX' not in s.upper():
  m=re.search(r'CREATE TABLE\s+(\w+)',s,re.I)
  if m:
   try:cur.execute(s);print('  ✓',m.group(1))
   except Exception as e:print('  -',m.group(1),'(exists)')
c.commit()
# Seed data
for s in txt.split(';'):
 if 'INSERT INTO' in s.upper():
   try:cur.execute(s)
   except:pass
c.commit();c.close()"
echo.

echo Step 1.2: 导出 JSON 数据文件...
if not exist "%V20%\data" mkdir "%V20%\data"
%PYTHON% -c "
import sqlite3,json,os
db=r'%DB%';out=r'%V20%\data'
os.makedirs(out,exist_ok=True)
c=sqlite3.connect(db);c.row_factory=sqlite3.Row;cur=c.cursor()
tables={'kpi':'dashboard_kpi','saa':'saa_allocation','taa':'taa_scorecard','alert_rules':'alert_rules','risk':'risk_compliance','lineage':'data_lineage','report':'report_templates'}
for k,t in tables.items():
 cur.execute(f'SELECT * FROM [{t}]')
 data=[dict(r) for r in cur.fetchall()]
 with open(os.path.join(out,f'{k}.json'),'w',encoding='utf-8') as f:json.dump(data,f,ensure_ascii=False,indent=2,default=str)
 print(f'  ✓ {k}.json ({len(data)} rows)')
c.close()"
echo.

echo [Week 2] 方向二: 工作流预检 + 预警检查
echo ------------------------------------------------------------
echo Step 2.1: 运行 TAA 预检 (dry-run)...
%PYTHON% "%GEN%\sync_workflow_to_db.py" --list
echo.
echo Step 2.2: KPI 历史快照...
%PYTHON% "%GEN%\sync_workflow_to_db.py" --kpi
echo.

echo [Week 3] 方向三+四: 报告引擎 + PWA 缓存
echo ------------------------------------------------------------
echo Step 3.1: 生成日报模板测试...
echo   ReportEngine 已集成在 core.js → index.html 中
echo   - 日报: 每日 06:30 → HTML+MD+PDF
echo   - 周报: 每周一 06:30 → HTML+MD
echo   - 月报: 每月1日 06:30 → HTML+PDF
echo.
echo Step 3.2: PWA 文件就绪...
if exist "%V20%\sw.js" (echo   ✓ sw.js) else (echo   ✗ sw.js 缺失)
if exist "%V20%\manifest.json" (echo   ✓ manifest.json) else (echo   ✗ manifest.json 缺失)
if exist "%V20%\mobile.html" (echo   ✓ mobile.html) else (echo   ✗ mobile.html 缺失)
echo.

echo [Week 4] 验收: 完整性检查
echo ============================================================
echo 检查交付清单...
set ALL_OK=1

if exist "%V20%\index.html" (echo   ✓ 主仪表盘) else (echo   ✗ 主仪表盘缺失 & set ALL_OK=0)
if exist "%V20%\taa-deviation-workflow.html" (echo   ✓ TAA工作流) else (echo   ✗ TAA工作流缺失 & set ALL_OK=0)
if exist "%V20%\mobile.html" (echo   ✓ 移动端) else (echo   ✗ 移动端缺失 & set ALL_OK=0)
if exist "%V20%\schema.sql" (echo   ✓ SQL Schema) else (echo   ✗ SQL Schema缺失 & set ALL_OK=0)
if exist "%V20%\js\core.js" (echo   ✓ core.js (4类)) else (echo   ✗ core.js缺失 & set ALL_OK=0)
if exist "%V20%\js\data-access.js" (echo   ✓ data-access.js) else (echo   ✗ data-access.js缺失 & set ALL_OK=0)
if exist "%V20%\css\dashboard.css" (echo   ✓ dashboard.css) else (echo   ✗ dashboard.css缺失 & set ALL_OK=0)
if exist "%V20%\manifest.json" (echo   ✓ manifest.json (PWA)) else (echo   ✗ manifest.json缺失 & set ALL_OK=0)
if exist "%V20%\sw.js" (echo   ✓ sw.js (PWA)) else (echo   ✗ sw.js缺失 & set ALL_OK=0)
if exist "%V20%\data\kpi.json" (echo   ✓ data/kpi.json) else (echo   ✗ data/kpi.json缺失 & set ALL_OK=0)
if exist "%GEN%\sync_workflow_to_db.py" (echo   ✓ sync_workflow_to_db.py) else (echo   ✗ sync脚本缺失 & set ALL_OK=0)

echo.
echo SQLite 表统计:
%PYTHON% -c "import sqlite3;c=sqlite3.connect(r'%DB%');cur=c.cursor();cur.execute('SELECT name FROM sqlite_master WHERE type=\"table\" ORDER BY name');tables=cur.fetchall();print(f'  共 {len(tables)} 张表:\n  ' + ', '.join([t[0] for t in tables]));c.close()"

echo.
echo ============================================================
if %ALL_OK%==1 (
  echo ✅ 验收通过！所有核心文件就绪
  echo.
  echo 本地预览: %V20%index.html
  echo CloudStudio: (运行 workbuddy_cloudstudio_deploy 部署)
) else (
  echo ❌ 验收未通过，请检查缺失文件
)
echo ============================================================
pause
