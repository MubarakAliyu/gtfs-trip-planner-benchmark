require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT || 5050),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gtfs_trip_benchmark',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  gtfsDir: process.env.GTFS_DIR || './data/gtfs',
  benchmarkIterations: Number(process.env.BENCHMARK_ITERATIONS || 200),
  benchmarkWarmup: Number(process.env.BENCHMARK_WARMUP || 20),
  ingestMultiplier: Number(process.env.INGEST_MULTIPLIER || 1),
};
