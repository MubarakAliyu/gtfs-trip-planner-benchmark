const { MongoClient } = require('mongodb');
const { mongoUri } = require('./config');

let client;
let db;

async function connectMongo() {
  if (db) return db;
  client = new MongoClient(mongoUri);
  await client.connect();
  db = client.db();
  return db;
}

function collections(database) {
  return {
    agency: database.collection('agency'),
    stops: database.collection('stops'),
    routes: database.collection('routes'),
    trips: database.collection('trips'),
    stopTimes: database.collection('stop_times'),
    calendar: database.collection('calendar'),
    calendarDates: database.collection('calendar_dates'),
    segments: database.collection('trip_segments'),
  };
}

async function clearMongo(database) {
  const names = Object.values(collections(database));
  await Promise.all(names.map((c) => c.deleteMany({})));
}

async function insertData(database, data) {
  const c = collections(database);
  const entries = [
    [c.agency, data.agency],
    [c.stops, data.stops],
    [c.routes, data.routes],
    [c.trips, data.trips],
    [c.stopTimes, data.stopTimes],
    [c.calendar, data.calendar],
    [c.calendarDates, data.calendarDates],
    [c.segments, data.segments],
  ];

  for (const [collection, docs] of entries) {
    if (docs.length) await collection.insertMany(docs, { ordered: false });
  }

  await c.stopTimes.createIndex({ stop_id: 1, departure_seconds: 1 });
  await c.stopTimes.createIndex({ trip_id: 1, stop_sequence: 1 });
  await c.stopTimes.createIndex({ route_id: 1, stop_id: 1 });
  await c.trips.createIndex({ route_id: 1 });
  await c.segments.createIndex({ from_stop_id: 1, to_stop_id: 1, from_departure_seconds: 1 });
  await c.routes.createIndex({ route_id: 1 }, { unique: true });
  await c.stops.createIndex({ stop_id: 1 }, { unique: true });
}

async function findRoutesByStop(stopId, limit = 10) {
  const c = collections(db);
  return c.stopTimes.aggregate([
    { $match: { stop_id: stopId, route_id: { $ne: null } } },
    { $group: { _id: '$route_id', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'routes',
        localField: '_id',
        foreignField: 'route_id',
        as: 'route',
      },
    },
    { $unwind: '$route' },
    {
      $project: {
        _id: 0,
        route_id: '$_id',
        route_short_name: '$route.route_short_name',
        route_long_name: '$route.route_long_name',
        route_type: '$route.route_type',
        stop_time_count: '$count',
      },
    },
  ]).toArray();
}

async function findDepartures(stopId, afterSeconds, limit = 10) {
  const c = collections(db);
  return c.stopTimes.aggregate([
    { $match: { stop_id: stopId, departure_seconds: { $gte: afterSeconds } } },
    { $sort: { departure_seconds: 1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        trip_id: 1,
        route_id: 1,
        route_short_name: 1,
        departure_time: 1,
        departure_seconds: 1,
      },
    },
  ]).toArray();
}

async function findDirectTrips(fromStopId, toStopId, afterSeconds = 0, limit = 10) {
  const c = collections(db);
  return c.segments
    .find({
      from_stop_id: fromStopId,
      to_stop_id: toStopId,
      from_departure_seconds: { $gte: afterSeconds },
    })
    .sort({ from_departure_seconds: 1 })
    .limit(limit)
    .project({ _id: 0 })
    .toArray();
}

async function stats() {
  const c = collections(db);
  return {
    agency: await c.agency.countDocuments(),
    stops: await c.stops.countDocuments(),
    routes: await c.routes.countDocuments(),
    trips: await c.trips.countDocuments(),
    stop_times: await c.stopTimes.countDocuments(),
    calendar: await c.calendar.countDocuments(),
    calendar_dates: await c.calendarDates.countDocuments(),
    trip_segments: await c.segments.countDocuments(),
  };
}

async function closeMongo() {
  if (client) await client.close();
  client = undefined;
  db = undefined;
}

module.exports = {
  connectMongo,
  clearMongo,
  insertData,
  findRoutesByStop,
  findDepartures,
  findDirectTrips,
  stats,
  closeMongo,
};
