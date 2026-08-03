# Visitor counter + analytics

Node service for `maotaiworks.com`:

- `GET/POST /api/visit` — site-wide unique visitors
- `POST /api/event` — per-app view / download / use events
- `POST /api/admin/login|logout`, `GET /api/admin/stats` — admin dashboard API

## Deploy

```bash
sudo rsync -a ./ /opt/maotaiworks/visitor-counter/
sudo cp maotaiworks-visitors.service /etc/systemd/system/
# /etc/maotaiworks/admin.env should contain: ADMIN_PASSWORD=...
sudo systemctl daemon-reload
sudo systemctl enable --now maotaiworks-visitors
```

Nginx proxies `/api/visit`, `/api/event`, `/api/admin/` to `127.0.0.1:3190`.
The static admin UI lives at `/admin/` (built with the Vite MPA as `admin`).
