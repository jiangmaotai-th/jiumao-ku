# 每日刮刮乐账号服务

监听 `127.0.0.1:3194`，数据目录默认 `/var/lib/maotaiworks/scratch`。

游客可在浏览器本机游玩；注册/登录/跨设备存档走本服务。未配置 SMTP 时，发验证码会失败，游客模式不受影响。

```bash
sudo mkdir -p /opt/maotaiworks/scratch-account /var/lib/maotaiworks/scratch
sudo rsync -a ./ /opt/maotaiworks/scratch-account/
sudo chown -R www-data:www-data /var/lib/maotaiworks/scratch /opt/maotaiworks/scratch-account
cd /opt/maotaiworks/scratch-account && sudo npm install --omit=dev
sudo cp maotaiworks-scratch.service /etc/systemd/system/
sudo systemctl enable --now maotaiworks-scratch.service
```

Nginx 需包含 `location /scratch/` 与 `location /api/account/`（见 `deploy/nginx.conf.example`）。
