# 套大鹅预览站

公开地址：https://srpg.maotaiworks.com/  
主站 `maotaiworks.com` 不列出、不构建这款游戏。

在仓库根目录：

```bash
npm run build:goose
rsync -az --delete dist-goose/ myserver:/tmp/goose-dist/
```

然后在服务器上切一次发布目录（见上一次部署用的 `releases/` + `current` 软链），并确认 `/etc/nginx/sites-available/srpg.maotaiworks.com` 与本目录 `nginx.conf` 一致。
