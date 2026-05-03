module.exports = {
  apps: [{
    name: 'ai-draw',
    script: 'server/index.js',
    cwd: __dirname,
    env: {
      NODE_ENV: 'production',
    },
    // Restart if memory exceeds 500MB
    max_memory_restart: '500M',
    // Log settings
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: 'logs/error.log',
    out_file: 'logs/out.log',
    merge_logs: true,
  }],
};
