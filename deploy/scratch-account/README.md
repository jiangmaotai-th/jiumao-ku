# 刮刮乐 / 水族缸存档服务

监听 `127.0.0.1:3194`。存档目录默认 `/var/lib/maotaiworks/scratch/data`（`saves.json` 按站点账号 id 分档，`serials.json` 为奖票序号）。

登录走站点账号 `http://127.0.0.1:3196/api/auth/me`（cookie `maotai_sid`）。`/load` 与 `/save` 把进来的 `Cookie` 原样转给该接口。游客仍在浏览器本机游玩。

```bash
sudo bash install.sh
```

`install.sh` 会先把 `/opt/maotaiworks/scratch-account` 和 `/var/lib/maotaiworks/scratch/data` 拷到 `/root/scratch-bak-<时间>`，再覆盖代码并重启 `maotaiworks-scratch`。

Nginx 需包含 `location /scratch/`、`location /tank/` 与 `location /api/account/`（见 `deploy/nginx.conf.example`）。站点登录是 `/api/auth/`，由 maotai-auth 提供。
