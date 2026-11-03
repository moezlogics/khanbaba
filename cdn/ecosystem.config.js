module.exports = {
  apps: [
    {
      name: "khanbaba-cdn",
      cwd: "/home/khanbaba-cdn/htdocs/cdn.khanbaba.pk",
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        PORT: 3251,
        NODE_ENV: "production"
      },
      error_file: "/home/khanbaba-cdn/htdocs/cdn.khanbaba.pk/logs/cdn-error.log",
      out_file: "/home/khanbaba-cdn/htdocs/cdn.khanbaba.pk/logs/cdn-out.log",
      merge_logs: true,
      time: true
    }
  ]
};

