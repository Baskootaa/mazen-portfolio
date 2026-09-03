/* ══════════════════════════════════════════════════════════════
   PROJECT REACTIONS API — Vercel Serverless Function (Node.js, zero-dependency)

   GET /api/reactions  → returns current counts for all projects
   POST /api/reactions → increments/decrements a reaction type for a project
══════════════════════════════════════════════════════════════ */

'use strict';

function findEnv(match, reject) {
  const env = process.env;
  for (const key of Object.keys(env)) {
    if (match.test(key) && (!reject || !reject.test(key)) && env[key]) return env[key];
  }
  return undefined;
}

const REDIS_URL =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL ||
  findEnv(/REST_API_URL$|REDIS_REST_URL$/);
const REDIS_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN ||
  findEnv(/REST_API_TOKEN$|REDIS_REST_TOKEN$/, /READ_ONLY/);

const PROJECTS = ['blood-bank', 'gym-membership'];
const TYPES    = ['like', 'love', 'star'];
const RL_WINDOW = 60; // seconds
const RL_LIMIT  = 15; // max requests per window per IP

function cacheEnabled() { return Boolean(REDIS_URL && REDIS_TOKEN); }

async function redis(command) {
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`Redis responded ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return xff.split(',')[0].trim();
  return req.headers['x-real-ip'] || '127.0.0.1';
}

async function getAllReactions() {
  const reactions = {};
  for (const p of PROJECTS) {
    reactions[p] = { like: 0, love: 0, star: 0 };
    if (!cacheEnabled()) continue;
    try {
      const hash = await redis(['HGETALL', `reactions:${p}`]);
      if (Array.isArray(hash)) {
        for (let i = 0; i < hash.length; i += 2) {
          const field = hash[i];
          const val = parseInt(hash[i + 1], 10);
          if (TYPES.includes(field) && !isNaN(val)) {
            reactions[p][field] = val;
          }
        }
      }
    } catch (_) { /* ignore redis read errors per project */ }
  }
  return reactions;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'GET') {
    if (!cacheEnabled()) {
      return res.status(200).json({ configured: false, reactions: {} });
    }
    try {
      const reactions = await getAllReactions();
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ configured: true, reactions });
    } catch (err) {
      return res.status(502).json({ error: 'Could not fetch reactions.' });
    }
  }

  if (req.method === 'POST') {
    if (!cacheEnabled()) {
      return res.status(503).json({ error: 'Reactions backend not configured.' });
    }

    let body = req.body;
    if (!body && req.readable) {
      try {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch (_) {
        return res.status(400).json({ error: 'Invalid JSON body.' });
      }
    }

    const { project, type, delta } = body || {};
    if (!PROJECTS.includes(project)) return res.status(400).json({ error: 'Unknown project.' });
    if (!TYPES.includes(type))       return res.status(400).json({ error: 'Unknown reaction type.' });
    if (delta !== 1 && delta !== -1) return res.status(400).json({ error: 'Invalid delta.' });

    // Rate limit: a bucket of RL_LIMIT actions per IP per window.
    try {
      const rlKey = `reactions:rl:${clientIp(req)}`;
      const n = await redis(['INCR', rlKey]);
      if (n === 1) await redis(['EXPIRE', rlKey, String(RL_WINDOW)]);
      if (n > RL_LIMIT) return res.status(429).json({ error: 'Too many reactions — slow down a moment.' });
    } catch (_) { /* never let a limiter failure block a reaction */ }

    try {
      let count = await redis(['HINCRBY', `reactions:${project}`, type, String(delta)]);
      if (typeof count === 'number' && count < 0) {
        await redis(['HSET', `reactions:${project}`, type, '0']);
        count = 0;
      }
      return res.status(200).json({ ok: true, project, type, count });
    } catch (err) {
      return res.status(500).json({ error: 'Could not save your reaction.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed.' });
};
