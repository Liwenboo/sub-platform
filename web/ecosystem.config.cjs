module.exports = {
  apps: [
    {
      name: "sub-platform",
      cwd: __dirname,
      script: "npm",
      args: "run start -- --hostname 127.0.0.1 --port 3000",
      interpreter: "none",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      time: true,
      min_uptime: "10s",
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      max_memory_restart: "512M",
      kill_timeout: 5000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
