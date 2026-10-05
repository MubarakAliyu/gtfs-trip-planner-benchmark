const express = require('express');
const path = require('path');
const mongo = require('./mongo');
const redis = require('./redis');
const { runMongoQuery, runRedisQuery } = require('./queries');
const { port } = require('./config');

const app = express();
app.use(express.json());
app.use(express.static(path.resolve('./public')));

app.get('/api/health', async (req, res) => {
  try {
    const db = await mongo.connectMongo();
    await db.command({ ping: 1 });
    await redis.client().ping();
    res.json({ status: 'ok', mongodb: 'connected', redis: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'error', message: error.message });
  }
});

app.get('/api/query/mongodb', async (req, res) => {
  try {
    const type = req.query.type || 'directTrips';
    const args = {
      stopId: req.query.stop,
      afterSeconds: req.query.after ? Number(req.query.after) : undefined,
      fromStopId: req.query.from,
      toStopId: req.query.to,
      limit: req.query.limit ? Number(req.query.limit) : 10,
    };
    res.json({ database: 'MongoDB', type, results: await runMongoQuery(type, args) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/query/redis', async (req, res) => {
  try {
    const type = req.query.type || 'directTrips';
    const args = {
      stopId: req.query.stop,
      afterSeconds: req.query.after ? Number(req.query.after) : undefined,
      fromStopId: req.query.from,
      toStopId: req.query.to,
      limit: req.query.limit ? Number(req.query.limit) : 10,
    };
    res.json({ database: 'Redis', type, results: await runRedisQuery(type, args) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    res.json({ mongodb: await mongo.stats(), redis: await redis.stats() });
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

mongo.connectMongo()
  .then(() => {
    redis.client();
    app.listen(port, () => console.log(`GTFS Trip Planner running at http://localhost:${port}`));
  })
  .catch((error) => {
    console.error('Startup failed. Run MongoDB and Redis first.', error.message);
    process.exit(1);
  });
