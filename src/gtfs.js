const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { gtfsDir, ingestMultiplier } = require('./config');

const REQUIRED_FILES = [
  'agency.txt',
  'stops.txt',
  'routes.txt',
  'trips.txt',
  'stop_times.txt',
  'calendar.txt',
  'calendar_dates.txt',
];

function readCsv(fileName) {
  const filePath = path.resolve(gtfsDir, fileName);
  if (!fs.existsSync(filePath)) throw new Error(`Missing GTFS file: ${filePath}`);
  return parse(fs.readFileSync(filePath, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
    trim: false,
  });
}

function timeToSeconds(value) {
  if (value == null || value === '') return null;
  const [h, m, s] = value.split(':').map(Number);
  if ([h, m, s].some(Number.isNaN)) return null;
  return h * 3600 + m * 60 + s;
}

function cloneScaledRows(rows, idField, multiplier) {
  if (multiplier <= 1) return rows;
  const result = [];
  for (let copy = 1; copy <= multiplier; copy += 1) {
    for (const row of rows) {
      result.push({
        ...row,
        [idField]: `${row[idField]}__scale${copy}`,
      });
    }
  }
  return result;
}

function loadGtfs() {
  for (const file of REQUIRED_FILES) {
    const p = path.resolve(gtfsDir, file);
    if (!fs.existsSync(p)) throw new Error(`GTFS dataset incomplete: ${file} is missing.`);
  }

  const agency = readCsv('agency.txt');
  const stops = readCsv('stops.txt');
  const routes = readCsv('routes.txt');
  const originalTrips = readCsv('trips.txt');
  const originalStopTimes = readCsv('stop_times.txt');
  const calendar = readCsv('calendar.txt');
  const calendarDates = readCsv('calendar_dates.txt');

  // Scale only trip-level records so the same routes/stops are exercised with more schedule rows.
  const trips = cloneScaledRows(originalTrips, 'trip_id', ingestMultiplier);
  const stopTimes = [];
  for (let copy = 1; copy <= Math.max(1, ingestMultiplier); copy += 1) {
    for (const row of originalStopTimes) {
      const suffix = ingestMultiplier > 1 ? `__scale${copy}` : '';
      stopTimes.push({
        ...row,
        trip_id: `${row.trip_id}${suffix}`,
        stop_sequence: Number(row.stop_sequence),
        arrival_seconds: timeToSeconds(row.arrival_time),
        departure_seconds: timeToSeconds(row.departure_time),
      });
    }
  }

  const routeById = new Map(routes.map((route) => [route.route_id, route]));
  const tripById = new Map(trips.map((trip) => [trip.trip_id, trip]));
  for (const row of stopTimes) {
    const trip = tripById.get(row.trip_id);
    const route = trip ? routeById.get(trip.route_id) : null;
    row.route_id = trip?.route_id || null;
    row.route_short_name = route?.route_short_name || null;
  }

  // Application-oriented derived index for direct trip planning between adjacent stops.
  const grouped = new Map();
  for (const row of stopTimes) {
    if (!grouped.has(row.trip_id)) grouped.set(row.trip_id, []);
    grouped.get(row.trip_id).push(row);
  }

  const segments = [];
  for (const [tripId, rows] of grouped.entries()) {
    rows.sort((a, b) => a.stop_sequence - b.stop_sequence);
    for (let i = 0; i < rows.length - 1; i += 1) {
      const from = rows[i];
      const to = rows[i + 1];
      segments.push({
        trip_id: tripId,
        route_id: from.route_id,
        route_short_name: from.route_short_name,
        from_stop_id: from.stop_id,
        to_stop_id: to.stop_id,
        from_departure_seconds: from.departure_seconds,
        to_arrival_seconds: to.arrival_seconds,
        duration_seconds:
          from.departure_seconds != null && to.arrival_seconds != null
            ? to.arrival_seconds - from.departure_seconds
            : null,
      });
    }
  }

  return {
    agency,
    stops,
    routes,
    trips,
    stopTimes,
    calendar,
    calendarDates,
    segments,
    originalTripCount: originalTrips.length,
    originalStopTimeCount: originalStopTimes.length,
  };
}

module.exports = { loadGtfs, timeToSeconds };
