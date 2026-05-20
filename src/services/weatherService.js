'use strict';

const axios = require('axios');
const config = require('../config');

const BASE = 'https://api.openweathermap.org/data/2.5/weather';

const ALLOWED_MAIN = new Set([
  'Clear',
  'Clouds',
  'Rain',
  'Drizzle',
  'Thunderstorm',
  'Snow',
  'Mist',
  'Fog',
  'Haze',
  'Smoke',
  'Dust',
  'Sand',
  'Ash',
  'Squall',
  'Tornado',
]);

function normalizeMain(main) {
  if (!main) return 'Clear';
  if (ALLOWED_MAIN.has(main)) return main;
  // Treat unknown atmospheric labels as Mist.
  return 'Mist';
}

async function getWeather(city) {
  config.assertOpenWeather();
  if (!city || typeof city !== 'string') {
    const err = new Error('City name is required');
    err.status = 400;
    throw err;
  }

  const res = await axios.get(BASE, {
    params: {
      q: city,
      appid: config.openWeatherApiKey,
      units: 'metric',
    },
    timeout: 15000,
    validateStatus: () => true,
  });

  if (res.status === 404) {
    const err = new Error(`City not found: ${city}`);
    err.status = 404;
    throw err;
  }
  if (res.status < 200 || res.status >= 300) {
    const err = new Error(
      `OpenWeather request failed (${res.status}): ${JSON.stringify(res.data)}`
    );
    err.status = 502;
    throw err;
  }

  const w = res.data || {};
  const first = (w.weather && w.weather[0]) || {};
  return {
    city: w.name || city,
    country: (w.sys && w.sys.country) || null,
    main: normalizeMain(first.main),
    description: first.description || '',
    icon: first.icon || null,
    code: first.id || null,
    temp: w.main ? w.main.temp : null,
    feelsLike: w.main ? w.main.feels_like : null,
    humidity: w.main ? w.main.humidity : null,
    windSpeed: w.wind ? w.wind.speed : null,
    cloudPct: w.clouds ? w.clouds.all : null,
  };
}

module.exports = { getWeather, normalizeMain };
