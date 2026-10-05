# GTFS Redis vs MongoDB Benchmark Results

Generated: 2026-10-05T10:35:31.733Z

| Query | MongoDB avg (ms) | Redis avg (ms) | MongoDB p95 (ms) | Redis p95 (ms) | Faster by average |
|---|---:|---:|---:|---:|---|
| routes_by_stop | 3.005 | 2.455 | 3.58 | 2.946 | Redis |
| departures_after_time | 1.358 | 1.095 | 1.905 | 1.258 | Redis |
| direct_trips | 0.988 | 1.1 | 1.265 | 1.36 | MongoDB |

## Interpretation

These results are workload- and environment-specific. The benchmark should be repeated after changing the dataset size, indexes, database versions, or network topology. They demonstrate application behavior for this project rather than a universal ranking of Redis and MongoDB.
