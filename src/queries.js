const mongo = require('./mongo');
const redis = require('./redis');
const { timeToSeconds } = require('./gtfs');

const DEFAULTS = {
  routesStop: 'airport',
  departureStop: 'airport',
  departureAfter: '13:00:00',
  origin: 'airport',
  destination: 'center',
};

async function runMongoQuery(type, args = {}) {
  if (type === 'routesByStop') return mongo.findRoutesByStop(args.stopId || DEFAULTS.routesStop, args.limit || 10);
  if (type === 'departures') return mongo.findDepartures(args.stopId || DEFAULTS.departureStop, args.afterSeconds ?? timeToSeconds(DEFAULTS.departureAfter), args.limit || 10);
  if (type === 'directTrips') return mongo.findDirectTrips(args.fromStopId || DEFAULTS.origin, args.toStopId || DEFAULTS.destination, args.afterSeconds ?? 0, args.limit || 10);
  throw new Error(`Unknown query type: ${type}`);
}

async function runRedisQuery(type, args = {}) {
  if (type === 'routesByStop') return redis.findRoutesByStop(args.stopId || DEFAULTS.routesStop, args.limit || 10);
  if (type === 'departures') return redis.findDepartures(args.stopId || DEFAULTS.departureStop, args.afterSeconds ?? timeToSeconds(DEFAULTS.departureAfter), args.limit || 10);
  if (type === 'directTrips') return redis.findDirectTrips(args.fromStopId || DEFAULTS.origin, args.toStopId || DEFAULTS.destination, args.afterSeconds ?? 0, args.limit || 10);
  throw new Error(`Unknown query type: ${type}`);
}

module.exports = { runMongoQuery, runRedisQuery, DEFAULTS };
