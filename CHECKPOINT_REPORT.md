# Checkpoint Report

## Application-Based Benchmarking on Redis and MongoDB for Trip Planning using GTFS Data

### Student
Mubarak Aliyu

## 1. Introduction to GTFS Data

GTFS (General Transit Feed Specification) is an open standard for publishing public transit information in a format that software applications can consume. A GTFS Schedule feed is commonly distributed as a ZIP containing text/CSV files. Core schedule entities include agencies, stops, routes, trips, and stop times.

For trip planning, these records can be combined to answer questions such as which routes serve a stop, when a vehicle is expected to depart, and whether a trip connects an origin and destination.

### Dataset used

The project uses the public `public-transport/sample-gtfs-feed` repository. The maintainers describe it as an imaginary GTFS dataset used for testing. This makes it appropriate for a reproducible educational checkpoint. The repository contains GTFS-related tables including agency, stops, routes, trips, stop_times, calendar, and calendar_dates.

Source: https://github.com/public-transport/sample-gtfs-feed
GTFS reference: https://gtfs.org/documentation/overview/

## 2. Overview of Redis and MongoDB

### Redis

Redis is an open-source in-memory key-value store that supports several data structures. Its strengths include very low-latency access, sorted sets, set operations, and efficient caching patterns.

### MongoDB

MongoDB is a document-oriented NoSQL database that stores flexible JSON-like BSON documents. It supports indexes, aggregation pipelines, and persistent storage suitable for complex and large-scale application data.

### Difference from traditional SQL databases

Relational SQL databases organize data into tables, rows, and columns with a relational schema. Redis and MongoDB are NoSQL systems but use different models: Redis focuses on keys and native data structures, while MongoDB focuses on documents and collections.

## 3. Benchmarking Criteria

The project measures:

- Average latency
- p50 latency
- p95 latency
- Minimum latency
- Maximum latency
- Query result-count agreement

The same logical query, dataset, and application process are used for both databases. This is important because application-level performance depends on more than the database engine itself.

## 4. Data Ingestion and Storage

The Node.js ingestion process reads the GTFS text files and loads the data into MongoDB collections. It also transforms the data into Redis-native structures.

### MongoDB

Collections:

- agency
- stops
- routes
- trips
- stop_times
- calendar
- calendar_dates
- trip_segments

Indexes are created for stop/departure access, trip ordering, and direct segment searches.

### Redis

Structures:

- Hashes for stop, route, and trip metadata
- Sets for routes serving a stop
- Sorted sets for stop departures
- Sorted sets for direct origin/destination segments

## 5. Query Performance

The benchmark implements three trip-planning workloads.

### Query A — Routes by stop

Find routes that serve a selected stop, such as `airport`.

MongoDB uses `stop_times` plus a route lookup. Redis uses a stop-to-route set and route hashes.

### Query B — Next departures

Find the next departures from a stop after a specified time.

MongoDB performs an indexed filter and sort on `stop_times`. Redis performs a score-range lookup on a sorted set.

### Query C — Direct trips

Find trips traveling directly from `airport` to `center`.

MongoDB queries the derived `trip_segments` collection. Redis queries the corresponding sorted-set key.

## 6. Scalability and Efficiency

MongoDB is well suited to persistent GTFS data because the application needs durable storage and flexible querying across schedule entities. Redis is well suited to serving hot or precomputed trip-planning data with very low access overhead.

Because the bundled source feed is small and intentionally designed for testing, the project includes `INGEST_MULTIPLIER` to create a larger schedule workload from the same logical feed. This lets the benchmark test how latency changes as the number of trip and stop-time records increases.

### Recommendation

For a large-scale trip planner, use **MongoDB as the persistent primary store and Redis as a high-speed serving/cache layer**. This combines MongoDB's durable document storage and query capabilities with Redis's fast access to frequently requested schedule and route data.

## 7. Practical Application

The project includes an Express application with a small browser interface.

Implementation steps:

1. Validate the GTFS files.
2. Start MongoDB and Redis.
3. Ingest the same GTFS dataset into both databases.
4. Create MongoDB indexes and Redis data structures.
5. Expose equivalent API queries.
6. Execute the benchmark with warm-up and timed iterations.
7. Save JSON results.
8. Generate a Markdown summary.
9. Compare the measured latency and choose an architecture for the target workload.

## 8. Conclusion

Redis and MongoDB solve different parts of the trip-planning problem effectively. MongoDB is a strong persistent system of record for GTFS data and complex queries. Redis is a strong acceleration layer for high-frequency lookups and precomputed results.

The benchmark in this repository is intentionally reproducible. It records actual measurements from the machine where the commands are executed rather than inventing numbers. The final recommendation is therefore based on the measured workload plus each database's architectural strengths: **MongoDB for persistence and flexible querying; Redis for speed and frequently accessed trip-planning data.**

## Benchmark command

```bash
npm install
docker compose up -d
npm run check
npm run ingest
npm run benchmark
npm run report
```

The final benchmark table is generated at:

`benchmark-results/benchmark-report.md`
