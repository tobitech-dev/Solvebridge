'use strict';

const { MongoClient } = require('mongodb');

// Reuse one connection across invocations of the same serverless instance.
const state =
  global.__solvebridge || (global.__solvebridge = { client: null, promise: null, indexed: false });

async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  if (!state.promise) {
    state.client = new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 });
    state.promise = state.client.connect().catch((err) => {
      state.promise = null;
      throw err;
    });
  }
  await state.promise;

  const db = state.client.db(process.env.MONGODB_DB || 'solvebridge');

  if (!state.indexed) {
    state.indexed = true;
    Promise.all([
      db.collection('submissions').createIndex({ createdAt: -1 }),
      db.collection('submissions').createIndex({ status: 1, createdAt: -1 }),
      db.collection('submissions').createIndex({ ipHash: 1, createdAt: -1 }),
      // Failed login records disappear on their own after an hour.
      db.collection('loginAttempts').createIndex({ at: 1 }, { expireAfterSeconds: 3600 }),
    ]).catch((err) => {
      state.indexed = false;
      console.error('Index creation failed:', err.message);
    });
  }

  return db;
}

module.exports = { getDb };
