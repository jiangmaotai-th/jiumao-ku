# AI 订阅低价区查询器 API

Node 服务，监听 `127.0.0.1:3192`，数据目录默认 `/var/lib/maotaiworks/store`。

- 产品目录：`catalog.mjs`（`getProduct` 会叠加 `official-web-prices.mjs` 的 pricingUrl/planKeys）
- 官方公开价种子：`official-web-prices.mjs`（全目录；`missing` = 无可靠网页订阅价）
- 运行时网页价：`web-prices.json`（抓取/确认后写入）
- 历史：`history/`

## 部署

```bash
sudo mkdir -p /opt/maotaiworks/store-price /var/lib/maotaiworks/store
sudo rsync -a ./ /opt/maotaiworks/store-price/
sudo chown -R www-data:www-data /var/lib/maotaiworks/store /opt/maotaiworks/store-price
sudo cp maotaiworks-store.service /etc/systemd/system/
sudo cp maotaiworks-store-refresh.service /etc/systemd/system/
sudo cp maotaiworks-store-refresh.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now maotaiworks-store.service
sudo systemctl enable --now maotaiworks-store-refresh.timer
```

定时刷新：`maotaiworks-store-refresh.timer` 每天 **00:00（Asia/Shanghai）** 执行 `refresh-seeds?force=1`。

### 首页「更新时间」戳

首页 / `/store/` 标题后的时间来自 API 的 `updatedAt`（优先 `meta.contentUpdatedAt`）。

部署 AI 订阅价格或相关内容后，执行其一即可让时间戳跟上：

```bash
curl -sS -X POST 'http://127.0.0.1:3192/api/store/content-updated?reason=deploy'
# 或
node /opt/maotaiworks/store-price/mark-content-updated.mjs deploy
```

每日 `refresh-seeds` / `scrape-web` 成功后也会自动刷新该时间。

## 网页价流水线（方案 A）

1. 从 `official-web-prices.mjs` **种子**补齐缺失产品套餐  
2. **专用 scraper**（Kimi / Claude / Cursor 等）能抓则抓  
3. 其余产品 **GET pricingUrl 确认金额仍在** → `confirmed`；失败 → `stale`（保留旧价）  
4. 无可靠来源 → `missing`（不写编造价）  
5. 重建 web/desktop 缓存；日志：`/var/lib/maotaiworks/store/web-scrape-log.json`（含 `statusCounts`）

状态：`live` | `confirmed` | `fallback` | `stale` | `missing` | `seeded`

### 加新产品 / 修价格

1. 在 `official-web-prices.mjs` 增加 `entry(url, plans)` 或 `missing(note)`  
2. 必要时在 `web-scrape/scrapers/` 加专用 scraper 并挂到 `registry.mjs`  
3. 部署后跑：

```bash
cd /opt/maotaiworks/store-price && sudo -u www-data STORE_DATA_DIR=/var/lib/maotaiworks/store node web-scrape/index.mjs
# 或
curl -X POST 'http://127.0.0.1:3192/api/store/scrape-web'
```

### 只跑抓取

```bash
node web-scrape/index.mjs
node web-scrape/index.mjs --only=kimi,openai
```

首次种子刷新（后台）：

```bash
curl -X POST 'http://127.0.0.1:3192/api/store/refresh-seeds?limit=3'
```

Nginx 需包含 `location /store/` 与 `location /api/store/`（见 `deploy/nginx.conf.example`）。
