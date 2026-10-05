const { loadGtfs } = require('./gtfs');
const mongo = require('./mongo');
const redis = require('./redis');
const { ingestMultiplier } = require('./config');

(async () => {
  try {
    const data = loadGtfs();
    console.log(`Loaded GTFS dataset. Base trips: ${data.originalTripCount}; base stop_times: ${data.originalStopTimeCount}`);
    console.log(`Ingestion multiplier: ${ingestMultiplier}x`);
    console.log(`Expanded trips: ${data.trips.length}; expanded stop_times: ${data.stopTimes.length}; derived segments: ${data.segments.length}`);

    const db = await mongo.connectMongo();
    await mongo.clearMongo(db);
    await mongo.insertData(db, data);
    console.log('✅ MongoDB ingestion complete.');

    await redis.clearRedis();
    await redis.insertData(data);
    console.log('✅ Redis ingestion complete.');

    console.log('MongoDB stats:', await mongo.stats());
    console.log('Redis stats:', await redis.stats());
    console.log('✅ Ingestion finished.');
  } catch (error) {
    console.error('❌ Ingestion failed:', error.message);
    process.exitCode = 1;
  } finally {
    await Promise.allSettled([mongo.closeMongo(), redis.closeRedis()]);
  }
})();
