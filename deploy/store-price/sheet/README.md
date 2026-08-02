# 每日档位表同步

用桌面上的《AI产品与订阅档位清单》更新目录、变动说明，并补齐公开价。

## 每天怎么做

1. 把最新 xlsx 放到桌面（或任意路径）
2. 在本目录执行：

```bash
cd /Users/maotaiyima/maotai网站/deploy/store-price

# 1) 表格 → JSON（会复制为 sheet/latest.xlsx）
python3 sheet/import-sheet.py ~/Desktop/AI产品与订阅档位清单_YYYY-MM-DD更新.xlsx

# 2) 生成 overlay（变动说明/免费标识）+ price-patches（变动说明里的公开价）
node sheet/apply-sheet.mjs

# 3) 把公开价写入 web-prices.json
node sheet/sync-web-prices.mjs
```

3. 部署 `deploy/store-price` 到服务器并重启服务，再对变更产品 `refresh` web/desktop（或跑全量重建）。

## 产出文件

| 文件 | 作用 |
|------|------|
| `latest.xlsx` | 当日表格副本 |
| `latest.raw.json` | 表格原文 |
| `overlay.json` | 运行时合并进产品（变动说明、套餐结构、可免费） |
| `price-patches.json` | 覆盖/补齐官方公开月价 |

## 表格列

类别 / 产品 / 原始套餐结构 / 免费·试用 / 个人付费档 / 团队·企业 / API·点数 / 买断·硬件 / 状态·备注 / **变动说明**

有「变动说明」的产品会在产品页展示该文案。
