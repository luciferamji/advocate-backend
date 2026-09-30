// CORS allowlist.
//
// CORS_ORIGINS (comma separated) wins when set. Otherwise the defaults are the
// app's own origins: pro.lawfyco.com (the app) and www.lawfyco.com / lawfyco.com
// (the public website posts consultation requests to /api/leads/consultation),
// plus FRONTEND_URL when configured. In development localhost:5173 is added.
// Requests without an Origin header (same-origin navigation, curl, server to
// server) are not affected by CORS and are let through.

const PRODUCTION_DEFAULTS = [
  'https://pro.lawfyco.com',
  'https://www.lawfyco.com',
  'https://lawfyco.com'
];

const normalise = (origin) => origin.trim().replace(/\/+$/, '').toLowerCase();

const getAllowedOrigins = (env = process.env) => {
  if (env.CORS_ORIGINS && env.CORS_ORIGINS.trim()) {
    return env.CORS_ORIGINS.split(',').map(normalise).filter(Boolean);
  }
  const origins = [...PRODUCTION_DEFAULTS];
  if (env.FRONTEND_URL) origins.push(env.FRONTEND_URL);
  if (env.NODE_ENV !== 'production') origins.push('http://localhost:5173');
  return [...new Set(origins.map(normalise))];
};

const buildCorsOptions = (env = process.env) => {
  const allowed = new Set(getAllowedOrigins(env));
  return {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      // Unknown origin: no CORS headers are sent, so the browser blocks it.
      return callback(null, allowed.has(normalise(origin)));
    },
    credentials: true
  };
};

module.exports = { buildCorsOptions, getAllowedOrigins };
