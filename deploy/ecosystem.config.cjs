module.exports = {
  apps: [
    {
      name: "sizor-api",
      cwd: __dirname + "/..",
      script: "app.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        // 3001 ocupado en el VPS; usar 3101
        PORT: 3101,
        HOST: "127.0.0.1",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3101,
        HOST: "127.0.0.1",
      },
    },
  ],
};
