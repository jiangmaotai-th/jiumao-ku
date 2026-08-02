# 九猫库

[maotaiworks.com](https://maotaiworks.com) — 原创软件与简单游戏下载站。

当前上架：

- **小午的图片转换** — 网页版 `/image/`（点开即用，本地 JPEG/PNG/WebP/BMP 互转）
- **魔书** — 网页版 `/ebook/`
- **MoyeeConverte** — 网页版 `/moyee/`（点开即用）+ macOS/Windows 安装包
- **魔窗**、**魔译** — Windows / macOS 安装包直链

## 小午的图片转换网页版

本地开发：

```bash
npm run dev
```

浏览器访问 `/image/`。图片只在浏览器内转换，不上传服务器。

能力概要：
- 输入：JPEG / PNG / WebP / BMP / HEIC / TIFF（HEIC/TIFF 用 WASM）
- 输出：JPEG / PNG / WebP / BMP / HEIC（HEIC 编码走 Worker + icodec）
- 目标大小质量阶梯、压缩中状态、失败重试、批量选择
- 完成后自动下载；多文件 ZIP 按格式分文件夹并尽量保留相对路径
- 不提供「选择输出目录」（Safari 不支持；需要指定文件夹请用桌面 Pro）

部署时 Nginx 需包含 `/image/` 的 `try_files`（见 `deploy/nginx.conf.example`）。首次 HEIC 编码会加载较大 WASM（约数 MB）。

## MoyeeConverte 网页版

本地开发时打开：

```bash
npm run dev
```

浏览器访问终端提示的地址，再进入 `/moyee/`。

首次使用会从 CDN 加载 FFmpeg.wasm（约 25MB，可缓存）。媒体文件只在浏览器内处理，不上传服务器。

## 本地开发

```bash
npm install
npm run dev
```

浏览器打开终端里提示的本地地址即可预览。

## 构建

```bash
npm run build
```

产物在 `dist/`。预览构建结果：

```bash
npm run preview
```

## 放置安装包

把安装包放进 `public/downloads/` 对应目录：

```text
public/downloads/mowin/windows.zip
public/downloads/mowin/mac.dmg
public/downloads/moyi/windows.zip
public/downloads/moyi/mac.dmg
```

详见 [public/downloads/README.md](public/downloads/README.md)。  
应用名称、简介、下载路径与分类标签在 [src/data/apps.ts](src/data/apps.ts) 的 `catalog` 数组修改。

分类字段 `category`：
- `software` → 软件
- `game` → 游戏
- `other` → 其他

首页右上角可按「全部 / 软件 / 游戏 / 其他」筛选。

## 部署到服务器

1. 域名 `maotaiworks.com` 的 A/AAAA 记录指向你的服务器。
2. 本地执行 `npm run build`，将 `dist/` 上传到服务器，例如 `/var/www/maotaiworks/dist`。
3. 参考 [deploy/nginx.conf.example](deploy/nginx.conf.example) 配置 Nginx。
4. 用 Certbot 申请证书（示例）：

```bash
sudo certbot --nginx -d maotaiworks.com -d www.maotaiworks.com
```

5. 重载 Nginx：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

安装包也可以不经过重新构建，直接上传到服务器站点根目录下的 `downloads/`，只要路径与 `apps.ts` 一致即可。
