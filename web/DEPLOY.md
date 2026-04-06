# sub-platform 部署与运维

适用场景：云服务器长期运行，使用 `PM2 + Nginx`。

## 1. 准备目录

项目目录示例：

```bash
/srv/sub-platform/web
```

后续命令都在这个目录执行：

```bash
cd /srv/sub-platform/web
```

## 2. 环境变量

必填：

```bash
ADMIN_USERNAME=your-admin-username
ADMIN_PASSWORD=your-admin-password
SESSION_SECRET=replace-with-a-long-random-secret
```

可选：

```bash
VIEWER_ACCESS_MODE=authenticated
SESSION_TTL_SECONDS=28800
SESSION_COOKIE_SECURE=auto
AUTH_MAX_FAILURES=5
AUTH_WINDOW_SECONDS=300
AUTH_BLOCK_SECONDS=300
```

建议：

- `VIEWER_ACCESS_MODE=authenticated` 更安全
- `SESSION_COOKIE_SECURE=auto` 适合放在 Nginx 后面
- 修改 `.env.production` 后必须 `pm2 restart sub-platform --update-env`

## 3. PM2 启动

仓库内配置文件：

```bash
ecosystem.config.cjs
```

启动：

```bash
pm2 start ecosystem.config.cjs --only sub-platform
pm2 save
```

重启：

```bash
pm2 restart sub-platform --update-env
```

停止：

```bash
pm2 stop sub-platform
```

日志：

```bash
pm2 logs sub-platform
```

状态：

```bash
pm2 status
```

当前 PM2 配置默认监听：

```bash
127.0.0.1:3000
```

## 4. 首次部署

```bash
cd /srv/sub-platform/web
npm ci
cp .env.example .env.production
```

编辑 `.env.production` 后：

```bash
npm run build
pm2 start ecosystem.config.cjs --only sub-platform
pm2 save
```

## 5. 标准发布流程

固定顺序，不要改：

1. 停服务
2. 删除 `.next`
3. 重新构建
4. 启动或重启服务

命令：

```bash
cd /srv/sub-platform/web
pm2 stop sub-platform
rm -rf .next
npm run build
pm2 start ecosystem.config.cjs --only sub-platform
```

如果服务已经存在，也可以最后一步改成：

```bash
pm2 restart sub-platform --update-env
```

如果有依赖变更，在 `rm -rf .next` 后补：

```bash
npm ci
```

## 6. 最小健康检查

确认 PM2：

```bash
pm2 status
pm2 logs sub-platform --lines 100
```

确认 3000 端口监听：

```bash
ss -lntp | grep 3000
```

确认 Next 本地可访问：

```bash
curl -I http://127.0.0.1:3000/login
curl -I http://127.0.0.1:3000/api/auth/session
```

确认 Nginx 反代正常：

```bash
curl -I https://your-domain.com/login
curl -I https://your-domain.com/api/auth/session
```

## 7. 常见问题

### 登录成功但仍是 viewer

优先检查：

- 浏览器是否收到 `sp_admin_session`
- `Set-Cookie` 是否与当前协议匹配
- Nginx 是否传了 `X-Forwarded-Proto`
- 是否执行过 `pm2 restart sub-platform --update-env`

### 页面变成无样式 HTML

通常是 HTML 和 `/_next/static` 资源不一致。直接按标准发布流程重新发一次：

```bash
pm2 stop sub-platform
rm -rf .next
npm run build
pm2 restart sub-platform --update-env
```

### `/_next/static` 资源异常

优先怀疑：

- 旧 `.next` 残留
- 服务未停就覆盖构建
- 反代拿到了新 HTML，但 Next 仍提供旧 chunk

先看：

```bash
pm2 logs sub-platform
```

然后重新按标准发布流程处理。

### `502 Bad Gateway`

优先检查：

- `pm2 status` 里进程是否还活着
- `127.0.0.1:3000` 是否真的在监听
- Nginx upstream 端口是否写对
- 应用是否启动失败

命令：

```bash
pm2 status
pm2 logs sub-platform
ss -lntp | grep 3000
```
