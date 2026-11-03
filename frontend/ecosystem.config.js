module.exports = {
  apps: [
    {
      name: "khanbaba",
      cwd: "/home/khanbaba/htdocs/khanbaba.pk",
      // We run the Next.js CLI binary directly through node for PM2 cluster mode support
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3250",
      instances: 1,
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      restart_delay: 5000,
      kill_timeout: 5000,
      listen_timeout: 10000,
      env: {
        PORT: 3250,
        NODE_ENV: "production"
      },
      error_file: "/home/khanbaba/htdocs/khanbaba.pk/logs/storefront-error.log",
      out_file: "/home/khanbaba/htdocs/khanbaba.pk/logs/storefront-out.log",
      merge_logs: true,
      time: true
    }
  ]
};
