const Redis = require('ioredis');
const { redisUrl } = require('./config');

let redis;

function client() {
  if (!redis) {
    redis = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: false });
    redis.on('error', (error) => console.error('Redis connection error:', error.message));
  }
  return redis;
}

async function clearRedis() {
  await client().flushdb();
}

async function hashSet(key, values) {
  const payload = {};
  for (const [k, v] of Object.entries(values)) payload[k] = v == null ? '' : String(v);
  if (Object.keys(payload).length) await client().hset(key, payload);
}

async function insertData(data) {
  const r = client();
  const pipeline = r.pipeline();

  for (const row of data.stops) {
    pipeline.hset(`gtfs:stop:${row.stop_id}`, {
      stop_name: row.stop_name || '',
      stop_lat: row.stop_lat || '',
      stop_lon: row.stop_lon || '',
      location_type: row.location_type || '',
    });
  }

  for (const row of data.routes) {
    pipeline.hset(`gtfs:route:${row.route_id}`, {
      route_short_name: row.route_short_name || '',
      route_long_name: row.route_long_name || '',
      route_type: row.route_type || '',
    });
  }

  for (const row of data.trips) {
    pipeline.hset(`gtfs:trip:${row.trip_id}`, {
      route_id: row.route_id || '',
      service_id: row.service_id || '',
      trip_headsign: row.trip_headsign || '',
    });
  }

  for (const row of data.stopTimes) {
    if (row.route_id) pipeline.sadd(`gtfs:stop_routes:${row.stop_id}`, row.route_id);
    if (row.departure_seconds != null) {
      const member = JSON.stringify({
        trip_id: row.trip_id,
        route_id: row.route_id,
        route_short_name: row.route_short_name,
        departure_time: row.departure_time,
        departure_seconds: row.departure_seconds,
      });
      pipeline.zadd(`gtfs:departures:${row.stop_id}`, row.departure_seconds, member);
    }
  }

  for (const row of data.segments) {
    if (row.from_departure_seconds == null) continue;
    const member = JSON.stringify(row);
    pipeline.zadd(`gtfs:segments:${row.from_stop_id}:${row.to_stop_id}`, row.from_departure_seconds, member);
  }

  await pipeline.exec();
}

async function findRoutesByStop(stopId, limit = 10) {
  const routeIds = await client().smembers(`gtfs:stop_routes:${stopId}`);
  const selected = routeIds.sort().slice(0, limit);
  if (!selected.length) return [];

  const pipeline = client().pipeline();
  for (const routeId of selected) pipeline.hgetall(`gtfs:route:${routeId}`);
  const responses = await pipeline.exec();
  return selected.map((routeId, i) => ({
    route_id: routeId,
    route_short_name: responses[i][1].route_short_name || null,
    route_long_name: responses[i][1].route_long_name || null,
    route_type: responses[i][1].route_type || null,
  }));
}

async function findDepartures(stopId, afterSeconds, limit = 10) {
  const members = await client().zrangebyscore(
    `gtfs:departures:${stopId}`,
    afterSeconds,
    '+inf',
    'LIMIT',
    0,
    limit,
  );
  return members.map((item) => JSON.parse(item));
}

async function findDirectTrips(fromStopId, toStopId, afterSeconds = 0, limit = 10) {
  const members = await client().zrangebyscore(
    `gtfs:segments:${fromStopId}:${toStopId}`,
    afterSeconds,
    '+inf',
    'LIMIT',
    0,
    limit,
  );
  return members.map((item) => JSON.parse(item));
}

async function stats() {
  const dbsize = await client().dbsize();
  return { redis_keys: dbsize };
}

async function closeRedis() {
  if (redis) {
    await redis.quit();
    redis = undefined;
  }
}

module.exports = {
  client,
  clearRedis,
  insertData,
  findRoutesByStop,
  findDepartures,
  findDirectTrips,
  stats,
  closeRedis,
};
