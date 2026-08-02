# 安装包目录

把各应用的安装包放到对应子目录后重新构建，或直接上传到服务器站点根目录下的 `downloads/`。

## 约定路径

| 应用 | Windows | macOS |
|------|---------|-------|
| 魔窗 (`mowin`) | `mowin/windows.zip` | `mowin/mac.dmg` |
| 魔译 (`moyi`) | `moyi/windows.zip` | `moyi/mac.dmg` |

示例：

```text
public/downloads/
  mowin/
    windows.zip
    mac.dmg
  moyi/
    windows.zip
    mac.dmg
```

路径或文件名若需更改，同步修改 `src/data/apps.ts` 里的 `href` 与 `filename`。
