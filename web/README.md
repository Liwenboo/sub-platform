# sub-platform

基于 Next.js 的轻量订阅管理平台，当前版本已经包含：

- admin 登录态与最小权限控制
- sources / outputs / settings 后台管理页
- Next 内置 API 与 SQLite 持久化 mock backend
- 面向云服务器部署的最小生产运行方案

## 环境变量

必填：

```bash
ADMIN_USERNAME=your-admin-username
ADMIN_PASSWORD=your-admin-password
SESSION_SECRET=replace-with-a-long-random-secret
```

可选：

```bash
SESSION_TTL_SECONDS=28800
VIEWER_ACCESS_MODE=authenticated
SESSION_COOKIE_SECURE=auto
AUTH_MAX_FAILURES=5
AUTH_WINDOW_SECONDS=300
AUTH_BLOCK_SECONDS=300
```

说明：

- `ADMIN_USERNAME`：管理员登录用户名
- `ADMIN_PASSWORD`：管理员登录密码
- `SESSION_SECRET`：session 签名密钥，必须使用高强度随机字符串
- `SESSION_TTL_SECONDS`：登录态有效期，默认 `28800`
- `VIEWER_ACCESS_MODE`：
  - `authenticated`：viewer 也需要先登录
  - `anonymous`：viewer 可匿名访问
- `SESSION_COOKIE_SECURE`：
  - `auto`：根据 `X-Forwarded-Proto` 或请求协议自动决定是否带 `Secure`
  - `true`：强制 `Secure`
  - `false`：强制不带 `Secure`
- `AUTH_MAX_FAILURES` / `AUTH_WINDOW_SECONDS` / `AUTH_BLOCK_SECONDS`：登录失败限流参数

兼容旧命名：

- `SUB_PLATFORM_ADMIN_USERNAME`
- `SUB_PLATFORM_ADMIN_PASSWORD`
- `SUB_PLATFORM_SESSION_SECRET`
- `SUB_PLATFORM_VIEWER_ACCESS_MODE`
- `SUB_PLATFORM_SESSION_COOKIE_SECURE`

当前 session cookie 行为：

- Cookie 名：`sp_admin_session`
- `HttpOnly: true`
- `SameSite: lax`
- `Path: /`
- 不设置 `Domain`
- 过期时间跟随 `SESSION_TTL_SECONDS`

## 本地开发

1. 复制环境变量样例：

```bash
cp .env.example .env.local
```

2. 按需修改 `.env.local`
3. 启动开发环境：

```bash
npm install
npm run dev
```

本地通过 `http://localhost` 访问时，建议保持：

```bash
SESSION_COOKIE_SECURE=auto
```

如果前面有反向代理，必须确保它传递正确的 `X-Forwarded-Proto`。

## 生产部署

建议：

- Node.js 使用稳定 LTS 版本
- 通过 `PM2 + Nginx` 运行
- 生产环境统一使用 `npm run build` + `next start`
- 每次发布前先停服务，再清 `.next`，避免 HTML 与 chunk 不一致

### 首次部署

```bash
cd /srv/sub-platform/web
npm ci
cp .env.example .env.production
```

编辑 `.env.production`，填入真实值后：

```bash
npm run build
pm2 start ecosystem.config.cjs --only sub-platform
pm2 save
```

### 标准发布流程

这是推荐的标准发布顺序，必须保持：

1. 停服务
2. 删除 `.next`
3. 重新构建
4. 启动或重启服务

命令示例：

```bash
cd /srv/sub-platform/web
pm2 stop sub-platform
rm -rf .next
npm ci
npm run build
pm2 restart sub-platform --update-env
```

说明：

- 如果这次发布没有依赖变化，`npm ci` 可以省略
- 如果是第一次启动，使用 `pm2 start ecosystem.config.cjs --only sub-platform`
- 修改了 `.env.production` 后，必须重新启动或 `pm2 restart ... --update-env`

## PM2 运行方案

仓库已提供 PM2 配置文件：[ecosystem.config.cjs](/d:\Codex\sub-platform\web\ecosystem.config.cjs)

配置要点：

- 工作目录：项目根目录 `web`
- 启动命令：`npm run start -- --hostname 127.0.0.1 --port 3000`
- 监听地址：`127.0.0.1:3000`
- 运行模式：单进程 `fork`
- 异常退出后自动拉起
- 启用时间戳日志
- 内存超过 `512M` 时自动重启

常用命令：

```bash
# 首次启动
pm2 start ecosystem.config.cjs --only sub-platform

# 重启并重新加载环境变量
pm2 restart sub-platform --update-env

# 停止
pm2 stop sub-platform

# 查看日志
pm2 logs sub-platform

# 查看状态
pm2 status
```

PM2 配置默认：

- 监听 `127.0.0.1:3000`
- 由 Nginx 对外暴露 80/443
- 进程异常自动拉起

如果你需要改端口，请同步修改：

- `ecosystem.config.cjs`
- Nginx upstream 配置

## 最小健康检查

发布完成后，先检查 Next 进程本身，再检查 Nginx 反代。

### 1. 确认 PM2 进程正常

```bash
pm2 status
pm2 logs sub-platform --lines 100
```

### 2. 确认 3000 端口已监听

任选一种：

```bash
ss -lntp | grep 3000
```

```bash
lsof -iTCP:3000 -sTCP:LISTEN
```

### 3. 直接探测 Next 本地服务

```bash
curl -I http://127.0.0.1:3000/login
curl -I http://127.0.0.1:3000/_next/static/
```

说明：

- `/login` 返回 `200` 或 `302` 都可以接受
- `/_next/static/` 不一定直接列目录，但不应直接返回 `502`

### 4. 确认 Nginx 反代正常

```bash
curl -I https://your-domain.com/login
curl -I https://your-domain.com/api/auth/session
```

如果外网域名异常、内网 `127.0.0.1:3000` 正常，优先排查 Nginx 配置与 upstream。

## Nginx 反向代理

最小反代示例：

```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

注意事项：

- `/_next/` 必须也走同一个 Next 进程，不要指到旧静态目录
- `/api/auth/login`、`/api/auth/logout`、`/api/auth/session` 不要被缓存
- 反代层不能吃掉 `Set-Cookie`
- 必须正确传 `X-Forwarded-Proto`，否则 `SESSION_COOKIE_SECURE=auto` 无法按真实协议判断

### Basic Auth 与站内 session 的关系

- Nginx Basic Auth 只是外层入口保护，不替代站内管理员 session
- 即使已经通过 Basic Auth，管理员仍需要在站内执行一次登录，才能获得 `sp_admin_session`
- 如果启用了 Basic Auth，建议对整个站点统一生效，不要只保护部分路径
- `/api/auth/*` 如果被单独绕开 Basic Auth，容易造成排查混乱；是否启用 Basic Auth，应该作为站点外层统一策略

## 故障排查

### 1. 登录成功但仍然是 viewer

优先检查：

1. 浏览器是否收到 `sp_admin_session`
2. 当前响应里的 `Set-Cookie` 是否符合访问协议
3. 反代是否正确传了 `X-Forwarded-Proto`
4. 修改 `.env.production` 后是否重启了进程

常见原因：

- 站点通过 `http` 访问，但 cookie 被错误地下发成 `Secure`
- `.env.production` 已更新，但 `pm2 restart --update-env` 没执行
- 浏览器收到了旧 session 或无效 session，服务端校验后安全降级为 viewer

建议排查：

```bash
pm2 logs sub-platform
```

并在浏览器开发者工具里检查：

- `POST /api/auth/login`
- `GET /api/auth/session`
- `GET /api/app-data`

### 2. 页面变成无样式 HTML

这通常表示：

- HTML 已更新
- 但对应的 `/_next/static/...` 资源没有正常返回

优先处理：

```bash
pm2 stop sub-platform
rm -rf .next
npm run build
pm2 restart sub-platform --update-env
```

### 3. `/_next/static` 资源返回 500

优先怀疑：

- 旧 `.next` 残留
- 发布时未先停服务
- HTML 与 chunk 混用

必须执行标准发布流程：

1. `pm2 stop sub-platform`
2. `rm -rf .next`
3. `npm run build`
4. `pm2 restart sub-platform --update-env`

如果仍失败，再看：

```bash
pm2 logs sub-platform
```

### 4. `502 Bad Gateway`

通常是 Nginx 找不到上游服务，优先检查：

1. PM2 进程是否存活
2. Next 是否真的监听在 `127.0.0.1:3000`
3. Nginx upstream 端口是否一致
4. 是否刚发布后应用启动失败

排查命令：

```bash
pm2 status
pm2 logs sub-platform
```

如果 PM2 里没有正常进程，重新启动：

```bash
pm2 start ecosystem.config.cjs --only sub-platform
```

## 运行前自检

部署完成后，至少做一次这组检查：

1. 管理员可以正常登录
2. 登录后进入 `/sources`
3. 刷新页面后仍保持 admin
4. `sources / outputs / settings` 三页能正常读写
5. 退出登录后回到 viewer
6. 浏览器里 `/_next/static/...` 资源全部返回 `200`
