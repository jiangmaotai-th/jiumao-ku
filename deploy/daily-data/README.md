# 每日数据：竞技场、AI 大事、AI 技能

这个目录是服务器上的独立任务，安装到 `/opt/maotaiworks-daily`。不要装进 `/opt/maotaiworks`（那里是订阅价格后端）。

每天约 **07:30（Asia/Shanghai）** 拉公开数据，原子写入站点 `dist` 里的三个目录：

- `arena-data/`：Arena.ai 公开榜（Hugging Face `lmarena-ai/leaderboard-dataset` 的 latest parquet）。不用 LLM。
- `ai-daily/`、`ai-skills/`：公开 RSS / API 的真实链接，再用 OpenAI 兼容接口做摘要和翻译。

默认模型是 DeepSeek。改 `LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL` 即可换成 OpenAI 或 Gemini 的兼容端点。密钥只放在服务器的 `/etc/maotaiworks/daily.env`，不要提交。

没有密钥、或接口超时/报错时，当天仍会发布：标题和短描述用原文，附上来源链接，不做摘要。翻译只在拒答、空文本或长度离谱时回退该条原文，不因为译文里少了某个英文词而整条作废。政策与监管、以及标题/摘要里像立法、制裁、出口管制这类内容，不交给模型改写，只保留原标题和链接；标题翻译通过上述安全检查才替换，否则保持原文。这些回退会写进日志，形如 `fallback id=… locale=… reason=…` 和 `policy source-only id=…`。

每种语言的 `latest.<slug>.json` 与中文 `latest.json` 使用同一天的 `date`、`updatedAt` 和条目数，否则页面会退回中文。`arena-data/seen.json` 只合并新模型，不删除已记录的模型；文件已存在但读不出来时，本次竞技场发布中止，避免把它盖掉。

来源一条都没有，或竞技场榜单缺榜、分数不像公开分，则保留昨天的文件，进程以退出码 1 结束。不会写空期，也不会删除 `dist` 里的其他文件。

## 服务器上要做的事

需要 Node.js 20 或更新（本仓库在 Node 22 上验证）。`www-data` 要能执行这个 `node`。

```bash
# 在仓库里
cd deploy/daily-data
sudo ./install.sh
sudoedit /etc/maotaiworks/daily.env
sudo systemctl enable --now maotaiworks-daily.timer
```

`install.sh` 会：

1. 把本目录同步到 `/opt/maotaiworks-daily`（不含 `node_modules`，不用 `--delete` 清掉站点）。
2. 在安装目录执行 `npm ci --omit=dev`。
3. 若还没有 `/etc/maotaiworks/daily.env`，从 `.env.example` 复制一份并 `chmod 600`。
4. 创建 `/var/log/maotaiworks`，并把 `DIST_DIR` 下的 `ai-daily`、`ai-skills`、`arena-data`（含 `v/`）交给 `www-data` 写。
5. 安装 systemd unit，把里面的 `NODE_BIN` 换成 `command -v node` 的绝对路径，然后 `daemon-reload`。它不会自动 enable。

### 环境变量（`/etc/maotaiworks/daily.env`）

| 变量 | 作用 |
| --- | --- |
| `DIST_DIR` | 站点根，默认 `/var/www/maotaiworks/dist` |
| `LOG_DIR` | 日志目录，默认 `/var/log/maotaiworks`，文件名 `daily.log` |
| `LLM_BASE_URL` | 默认 `https://api.deepseek.com` |
| `LLM_API_KEY` | 留空或 `replace-me` 时走原文回退 |
| `LLM_MODEL` | 默认 `deepseek-chat` |
| `GITHUB_TOKEN` | 可选。不填也能跑 GitHub 搜索，只是更容易撞上未登录限额 |

OpenAI：`https://api.openai.com/v1`。Gemini 兼容端点：`https://generativelanguage.googleapis.com/v1beta/openai`。示例写在 `.env.example`。

### 手工跑、试跑

```bash
# 试跑：写到临时目录，标准输出打印该目录。没有密钥也会写出合法 JSON。
sudo -u www-data node /opt/maotaiworks-daily/bin/run.mjs --dry-run

# 只更新竞技场，写到指定目录（不碰默认站点根）
node /opt/maotaiworks-daily/bin/run.mjs --arena --out /tmp/maotai-arena

# 写入 DIST_DIR
sudo -u www-data node /opt/maotaiworks-daily/bin/run.mjs --all
```

只跑一类：`--arena`、`--news`、`--skills`。指定密钥文件：`--env /etc/maotaiworks/daily.env`。

### 定时器与日志

`maotaiworks-daily.timer`：`OnCalendar=*-*-* 07:30:00`，`Timezone=Asia/Shanghai`，`Persistent=true`。

```bash
sudo systemctl enable --now maotaiworks-daily.timer
systemctl list-timers maotaiworks-daily.timer
journalctl -u maotaiworks-daily.service
sudo tail -f /var/log/maotaiworks/daily.log
```

### 整站重新部署时

`rsync --delete` 同步整个 `dist/` 会把这三份每日数据盖回仓库里的快照。发布站点时排除 `ai-daily/`、`ai-skills/`、`arena-data/`，或在发布后再跑一次：

```bash
sudo -u www-data node /opt/maotaiworks-daily/bin/run.mjs --all
```

Nginx 对这三个路径已经是不缓存的（见 `deploy/nginx.conf.example`）。本任务不改页面样式，也不动 `/opt/maotaiworks` 里的价格服务。
