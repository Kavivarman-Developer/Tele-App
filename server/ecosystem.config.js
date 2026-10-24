module.exports = {
  apps: [
    {
      name: 'hi-talk-api',
      script: './dist/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '500M',
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 5001,
      },
    },
  ],
};
