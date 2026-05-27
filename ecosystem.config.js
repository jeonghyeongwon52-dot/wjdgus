module.exports = {
  apps: [
    {
      name: "my-chat-app",
      script: "./index.js",
      instances: "max", // CPU 코어 수만큼 프로세스 생성 (클러스터 모드)
      exec_mode: "cluster",
      watch: false, // 운영 환경에서는 성능을 위해 false 권장
      max_memory_restart: "1G", // 메모리 점유율이 1GB를 넘으면 재시작
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      combine_logs: true,
    },
  ],
};
