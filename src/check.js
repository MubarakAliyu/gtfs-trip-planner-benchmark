const fs = require('fs');
const path = require('path');
const { loadGtfs } = require('./gtfs');

try {
  const data = loadGtfs();
  const files = fs.readdirSync(path.resolve('./data/gtfs')).filter((f) => f.endsWith('.txt'));
  const required = ['agency.txt', 'stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt', 'calendar.txt', 'calendar_dates.txt'];
  const missing = required.filter((f) => !files.includes(f));
  if (missing.length) throw new Error(`Missing: ${missing.join(', ')}`);
  if (!data.stops.length || !data.routes.length || !data.trips.length || !data.stopTimes.length) {
    throw new Error('Core GTFS tables must not be empty.');
  }
  console.log('✅ GTFS dataset structure check passed.');
  console.log({ agencies: data.agency.length, stops: data.stops.length, routes: data.routes.length, trips: data.trips.length, stopTimes: data.stopTimes.length, segments: data.segments.length });
} catch (error) {
  console.error('❌ Check failed:', error.message);
  process.exitCode = 1;
}
