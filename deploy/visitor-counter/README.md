# 访客计数 + 应用分析 + 后台

服务端口：`127.0.0.1:3190`

## API

- `POST /api/visit` — 全站 UV（首页）
- `POST /api/event` — `{ app, type: "view"|"download"|"use" }`
- `POST /api/admin/login` — `{ password }`
- `GET /api/admin/stats` — 需登录 Cookie
- 后台页面：`https://maotaiworks.com/admin/`

## 配置后台密码

```bash
sudo mkdir -p /etc/maotaiworks
sudo tee /etc/maotaiworks/admin.env >/dev/null <<'EOF'
ADMIN_PASSWORD=你的密码
EOF
sudo chmod 600 /etc/maotaiworks/admin.env
sudo systemctl restart maotaiworks-visitors
```

Nginx 需代理 `/api/visit`、`/api/event`、`/api/admin/`，并提供 `/admin/` 静态目录。
