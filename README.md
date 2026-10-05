# Application-Based Benchmarking on Redis and MongoDB for Trip Planning using GTFS Data

A Node.js checkpoint project that ingests a public GTFS Schedule dataset into **MongoDB** and **Redis**, exposes trip-planning queries through an Express app, and benchmarks the two databases under the same application workload.

## Checkpoint objective

The project addresses all eight checkpoint requirements:

1. Introduction to GTFS Data
2. Overview of Redis and MongoDB
3. Benchmarking Criteria
4. Data Ingestion and Storage
5. Query Performance
6. Scalability and Efficiency
7. Practical Application
8. Conclusion

## Public GTFS dataset used

This project uses the public `sample-gtfs-feed` dataset published by the `public-transport` GitHub organization. It is explicitly described by its maintainers as an **imaginary GTFS dataset used for testing** and includes GTFS schedule tables such as agency, stops, routes, trips, stop_times, calendar, and calendar_dates.

Source repository:
https://github.com/public-transport/sample-gtfs-feed

GTFS standard/reference:
https://gtfs.org/documentation/overview/

The local `data/gtfs/` files are a self-contained copy of the core schedule data from that public project so the checkpoint can be cloned and run without an external download during normal execution.

> Important: because the source feed is intentionally a small testing network rather than a large metropolitan production feed, the benchmark is used to demonstrate methodology and application behavior. The project includes a deterministic ingestion multiplier so a larger workload can be generated from the same GTFS schedule for stress testing.

## Architecture

```text
                     GTFS Schedule Files
                       (CSV / .txt)
                              |
                         Node.js parser
                              |
                  +-----------+-----------+
                  |                       |
              MongoDB                  Redis
          persistent store         in-memory store
                  |                       |
                  +-----------+-----------+
                              |
                       Express API
                              |
                    Simple Trip Planner UI
```

## MongoDB storage model

The raw GTFS entities are stored in separate collections:

- `agency`
- `stops`
- `routes`
- `trips`
- `stop_times`
- `calendar`
- `calendar_dates`

The project also creates a derived `trip_segments` collection. Each document represents two consecutive stops for a trip and makes direct-trip planning fast and easy to benchmark.

MongoDB indexes are created for the main application access paths, including stop/departure queries and trip segments.

## Redis storage model

Redis uses native data structures for application-oriented access:

- Hashes for stop, route, and trip metadata
- Sets for routes serving a stop
- Sorted sets for departures by stop
- Sorted sets for direct trip segments between two stops

This design demonstrates why Redis is useful for high-speed lookups and ordered time-based access.

## Benchmark criteria

The benchmark measures:

- Average latency
- p50 latency (median)
- p95 latency
- Minimum latency
- Maximum latency
- Result-count consistency between MongoDB and Redis

The benchmark runs the same query shape against both databases on the same environment. It performs configurable warm-up requests before collecting timed samples.

Default settings:

- Warm-up requests: 20
- Timed iterations: 200

## Benchmark workloads

### 1. Routes by stop

Question:
> Which routes serve this stop?

Default stop: `airport`

MongoDB uses a filter/group/lookup pipeline over `stop_times` and `routes`.

Redis uses a set containing route IDs for each stop and then retrieves route metadata from hashes.

### 2. Next departures

Question:
> What are the next departures from this stop after a specified time?

Default stop: `airport`

MongoDB sorts indexed `stop_times` documents by departure seconds.

Redis uses a sorted set and a score range query.

### 3. Direct trips

Question:
> Which trips travel directly from the origin stop to the destination stop?

Default route example:
`airport -> center`

MongoDB queries the derived `trip_segments` collection.

Redis queries the corresponding sorted-set key for the stop pair.

## Practical application

The Express application serves a small browser interface from `public/index.html`.

API endpoints:

- `GET /api/health`
- `GET /api/stats`
- `GET /api/query/mongodb`
- `GET /api/query/redis`

Examples:

```text
http://localhost:5050/api/health
http://localhost:5050/api/stats
http://localhost:5050/api/query/mongodb?type=directTrips&from=airport&to=center&limit=10
http://localhost:5050/api/query/redis?type=directTrips&from=airport&to=center&limit=10
```

## Setup on Windows / macOS / Linux

### Prerequisites

- Node.js 20+
- Docker Desktop (recommended for this checkpoint)

### 1. Start MongoDB and Redis

```bash
docker compose up -d
```

This starts:

- MongoDB on `localhost:27017`
- Redis on `localhost:6379`

### 2. Install Node dependencies

```bash
npm install
```

### 3. Create environment file

Copy `.env.example` to `.env`.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS / Linux:

```bash
cp .env.example .env
```

The default local connection values are already suitable for Docker Compose.

### 4. Validate the GTFS data

```bash
npm run check
```

### 5. Ingest GTFS into MongoDB and Redis

```bash
npm run ingest
```

This clears the project's MongoDB collections and Redis database, then reloads both from the same GTFS dataset.

### 6. Start the practical application

```bash
npm start
```

Open:

```text
http://localhost:5050
```

### 7. Run the benchmark

```bash
npm run benchmark
```

The measured results are written to:

```text
benchmark-results/latest.json
```

Then generate a readable Markdown report:

```bash
npm run report
```

Output:

```text
benchmark-results/benchmark-report.md
```

## Scaling the dataset for benchmarking

The bundled feed is intentionally small because the source project is a testing fixture. To exercise a larger workload while keeping the same logical GTFS schedule, set `INGEST_MULTIPLIER` before ingestion.

Example: 100x schedule workload

PowerShell:

```powershell
$env:INGEST_MULTIPLIER=100
npm run ingest
npm run benchmark
npm run report
```

macOS / Linux:

```bash
INGEST_MULTIPLIER=100 npm run ingest
npm run benchmark
npm run report
```

The multiplier replicates trip and stop-time records with deterministic IDs. Routes and stops stay shared, which makes it useful for measuring schedule-heavy workloads.

## Fair benchmarking notes

Benchmark results are **not universal rankings** of Redis and MongoDB. Results depend on:

- CPU and RAM of the machine
- MongoDB and Redis versions
- Dataset size
- Index configuration
- Number of benchmark iterations
- Local versus remote network latency
- Background system activity

The benchmark therefore reports measurements from the actual execution environment rather than invented figures.

## Checkpoint answers / discussion points

### 1. Introduction to GTFS data

GTFS (General Transit Feed Specification) is an open standard for distributing public transit information. GTFS Schedule commonly uses text/CSV files describing agencies, stops, routes, trips, and stop times. A trip-planning application can use this information to determine which services operate, where vehicles stop, and when vehicles arrive/depart.

### 2. Overview of Redis and MongoDB

Redis is an in-memory key-value store that supports data structures such as strings, sets, hashes, lists, and sorted sets. MongoDB is a document database that stores flexible JSON-like BSON documents. Compared with relational SQL databases, both use NoSQL approaches but organize data differently.

### 3. Benchmarking criteria

Important application-level criteria include latency, p50/p95 response time, throughput, memory usage, scalability, query complexity, and operational overhead. Benchmarking matters because a database that performs well for one workload may not be the best choice for another.

### 4. Data ingestion and storage

GTFS files are parsed by Node.js and loaded into MongoDB collections. Redis receives an application-oriented representation using hashes, sets, and sorted sets. MongoDB provides persistent document storage; Redis provides very fast memory-based access with optional persistence mechanisms.

### 5. Query performance

Typical trip-planning queries include finding routes serving a stop, finding upcoming departures, and finding direct trips between two stops. MongoDB executes indexed document queries and aggregation pipelines; Redis uses direct key/data-structure lookups such as set membership and sorted-set range queries.

### 6. Scalability and efficiency

MongoDB is the better fit for the **persistent source of truth** for a large GTFS dataset because the application needs durable, flexible document storage and more complex querying. Redis is excellent as a **high-speed acceleration layer** for frequently requested or precomputed trip-planning data.

### 7. Practical application

This project implements a simple trip-planning API and browser UI. The implementation flow is: validate GTFS → ingest into both databases → create indexes/Redis structures → run equivalent trip-planning queries → benchmark latency → save results → interpret the results.

### 8. Conclusion

Redis and MongoDB are complementary rather than mutually exclusive. MongoDB is suited to persistent GTFS storage and flexible queries, while Redis is suited to very fast access to frequently requested schedules, routes, and derived trip segments. For a production-scale trip planner, the recommended architecture is **MongoDB as the durable primary data store plus Redis as a caching/serving layer**, with benchmark results used to tune the exact structures and indexes for the target workload.

## Recommended submission contents

Submit the GitHub repository containing:

```text
gtfs-trip-planner-benchmark/
├── data/gtfs/
├── public/
├── src/
├── benchmark-results/
├── .env.example
├── .gitignore
├── docker-compose.yml
├── package.json
├── CHECKPOINT_REPORT.md
└── README.md
```

Do not commit `.env`, database passwords, or other secrets.

## Author

Mubarak Aliyu