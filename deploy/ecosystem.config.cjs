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
        PORT: 3001,
        HOST: "127.0.0.1",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3001,
        HOST: "127.0.0.1",
      },
    },
  ],
};
