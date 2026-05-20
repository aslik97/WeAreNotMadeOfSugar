'use strict';

const axios = require('axios');
const config = require('../config');

let cached = null;

async function fetchToken() {
  config.assertAdobe();
  const url = `${config.adobe.imsUrl.replace(/\/$/, '')}/ims/token/v3`;
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.adobe.clientId,
    client_secret: config.adobe.clientSecret,
    scope: config.adobe.scopes,
  });

  const res = await axios.post(url, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 30000,
    validateStatus: () => true,
  });

  if (res.status < 200 || res.status >= 300) {
    const err = new Error(
      `Adobe IMS token request failed (${res.status}): ${
        typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
      }`
    );
    err.status = 502;
    throw err;
  }

  const { access_token: accessToken, expires_in: expiresIn } = res.data;
  if (!accessToken) {
    const err = new Error('Adobe IMS response missing access_token');
    err.status = 502;
    throw err;
  }

  return {
    accessToken,
    expiresAt: Date.now() + (Number(expiresIn) || 3600) * 1000 - 60 * 1000,
  };
}

async function getAccessToken() {
  if (cached && cached.expiresAt > Date.now()) {
    return cached.accessToken;
  }
  cached = await fetchToken();
  return cached.accessToken;
}

function getApiKey() {
  return config.adobe.clientId;
}

module.exports = { getAccessToken, getApiKey };
