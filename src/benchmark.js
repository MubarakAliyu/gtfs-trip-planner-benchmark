const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const mongo = require('./mongo');
const redis = require('./redis');
const { runMongoQuery, runRedisQuery, DEFAULTS } = require('./queries');
const { benchmarkIterations, benchmarkWarmup } = require('./config');

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1));
  return sorted[index];
}

async function measure(fn, warmup, iterations) {
  for (let i = 0; i < warmup; i += 1) await fn();
  const samples = [];
  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    await fn();
    samples.push(performance.now() - start);
  }
  const total = samples.reduce((a, b) => a + b, 0);
  return {
    iterations,
    average_ms: Number((total / iterations).toFixed(3)),
    p50_ms: Number(percentile(samples, 0.5).toFixed(3)),
    p95_ms: Number(percentile(samples, 0.95).toFixed(3)),
    min_ms: Number(Math.min(...samples).toFixed(3)),
    max_ms: Number(Math.max(...samples).toFixed(3)),
  };
}

async function main() {
  await mongo.connectMongo();
  redis.client();

  const cases = [
    {
      id: 'routes_by_stop',
      description: 'Find all routes serving a stop',
      type: 'routesByStop',
      args: { stopId: DEFAULTS.routesStop, limit: 10 },
    },
    {
      id: 'departures_after_time',
      description: 'Find next departures at a stop after 13:00',
      type: 'departures',
      args: { stopId: DEFAULTS.departureStop, limit: 10 },
    },
    {
      id: 'direct_trips',
      description: 'Find direct trips from airport to city center',
      type: 'directTrips',
      args: { fromStopId: DEFAULTS.origin, toStopId: DEFAULTS.destination, limit: 10 },
    },
  ];

  const results = [];
  for (const testCase of cases) {
    // Sanity check that both backends answer the same logical query shape.
    const [mongoSample, redisSample] = await Promise.all([
      runMongoQuery(testCase.type, testCase.args),
      runRedisQuery(testCase.type, testCase.args),
    ]);

    // Run each backend separately so concurrent benchmark traffic does not distort the comparison.
    const mongoTiming = await measure(
      () => runMongoQuery(testCase.type, testCase.args),
      benchmarkWarmup,
      benchmarkIterations,
    );
    const redisTiming = await measure(
      () => runRedisQuery(testCase.type, testCase.args),
      benchmarkWarmup,
      benchmarkIterations,
    );

    results.push({
      query: testCase.id,
      description: testCase.description,
      sample_result_counts: { mongodb: mongoSample.length, redis: redisSample.length },
      mongodb: mongoTiming,
      redis: redisTiming,
    });
  }

  const payload = {
    generated_at: new Date().toISOString(),
    environment: {
      node: process.version,
      iterations: benchmarkIterations,
      warmup: benchmarkWarmup,
      mongo_uri: process.env.MONGO_URI ? '[configured]' : 'default-local',
      redis_url: process.env.REDIS_URL ? '[configured]' : 'default-local',
    },
    notes: [
      'Results are specific to the local machine, database versions, dataset size, indexes, and network topology.',
      'Use the same dataset and test process for both databases; do not treat these figures as universal database rankings.',
    ],
    results,
  };

  fs.mkdirSync(path.resolve('benchmark-results'), { recursive: true });
  fs.writeFileSync(path.resolve('benchmark-results/latest.json'), JSON.stringify(payload, null, 2));

  console.log('\n=== GTFS Redis vs MongoDB Benchmark ===');
  for (const row of results) {
    console.log(`\n${row.query} — ${row.description}`);
    console.log(`MongoDB  avg ${row.mongodb.average_ms} ms | p95 ${row.mongodb.p95_ms} ms`);
    console.log(`Redis    avg ${row.redis.average_ms} ms | p95 ${row.redis.p95_ms} ms`);
  }
  console.log('\n✅ Benchmark saved to benchmark-results/latest.json');
}

main()
  .catch((error) => {
    console.error('❌ Benchmark failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([mongo.closeMongo(), redis.closeRedis()]);
  });
