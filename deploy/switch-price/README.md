# Switch eShop 低价查询 API

Node 服务，监听 `127.0.0.1:3193`，数据目录默认 `/var/lib/maotaiworks/switch`。

```bash
sudo mkdir -p /opt/maotaiworks/switch-price /var/lib/maotaiworks/switch
sudo rsync -a ./ /opt/maotaiworks/switch-price/
sudo chown -R www-data:www-data /var/lib/maotaiworks/switch /opt/maotaiworks/switch-price
sudo cp maotaiworks-switch.service /etc/systemd/system/
sudo cp maotaiworks-switch-refresh.service /etc/systemd/system/
sudo cp maotaiworks-switch-refresh.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now maotaiworks-switch.service
sudo systemctl enable --now maotaiworks-switch-refresh.timer
```

Nginx 需包含 `location /switch/` 与 `location /api/switch/`。
