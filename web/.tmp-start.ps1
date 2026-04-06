$env:ADMIN_USERNAME = "admin"
$env:ADMIN_PASSWORD = "pass123"
$env:SESSION_SECRET = "test-secret-1234567890"
$env:VIEWER_ACCESS_MODE = "authenticated"
$env:SESSION_COOKIE_SECURE = "auto"
npm run start -- --hostname 127.0.0.1 --port 3101
