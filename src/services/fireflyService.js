'use strict';

const axios = require('axios');
const config = require('../config');
const { getAccessToken, getApiKey } = require('../auth/adobeAuth');

const DEFAULT_SIZE = { width: 2048, height: 2048 };

function pickImageUrl(payload) {
  if (!payload) return null;
  if (Array.isArray(payload.outputs) && payload.outputs.length > 0) {
    const first = payload.outputs[0];
    if (first && first.image && first.image.url) return first.image.url;
    if (first && first.image && first.image.presignedUrl) {
      return first.image.presignedUrl;
    }
    if (first && first.url) return first.url;
  }
  if (payload.image && payload.image.url) return payload.image.url;
  return null;
}

async function pollJob(jobUrl, token) {
  const deadline = Date.now() + 180 * 1000;
  let lastStatus = null;
  while (Date.now() < deadline) {
    const res = await axios.get(jobUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-api-key': getApiKey(),
        Accept: 'application/json',
      },
      timeout: 20000,
      validateStatus: () => true,
    });
    if (res.status < 200 || res.status >= 300) {
      const err = new Error(
        `Firefly job poll failed (${res.status}): ${JSON.stringify(res.data)}`
      );
      err.status = 502;
      throw err;
    }
    const body = res.data || {};
    const status = (body.status || '').toLowerCase();
    lastStatus = status;
    if (
      status === 'succeeded' ||
      status === 'success' ||
      status === 'completed' ||
      status === 'done'
    ) {
      const url = pickImageUrl(body.result || body);
      if (!url) {
        const err = new Error(
          'Firefly job succeeded but no image URL in response'
        );
        err.status = 502;
        err.details = body;
        throw err;
      }
      return url;
    }
    if (status === 'failed' || status === 'error' || status === 'cancelled') {
      const err = new Error(
        `Firefly job failed: ${JSON.stringify(body.error || body)}`
      );
      err.status = 502;
      throw err;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  const err = new Error(
    `Firefly job timed out (last status: ${lastStatus || 'unknown'})`
  );
  err.status = 504;
  throw err;
}

async function generateImage({
  prompt,
  size = DEFAULT_SIZE,
  contentClass = 'photo',
  numVariations = 1,
}) {
  if (!prompt) {
    const err = new Error('Firefly prompt is required');
    err.status = 400;
    throw err;
  }
  config.assertFirefly();
  const token = await getAccessToken();
  const url = `${config.adobe.fireflyApiUrl.replace(
    /\/$/,
    ''
  )}/v3/images/generate-async`;

  const body = {
    prompt,
    contentClass,
    numVariations,
    size,
  };

  const res = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-api-key': getApiKey(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    timeout: 60000,
    validateStatus: () => true,
  });

  if (res.status >= 200 && res.status < 300) {
    const direct = pickImageUrl(res.data);
    if (direct) return direct;

    const links = res.data && res.data._links;
    const jobUrl =
      (links && (links.self || links.status || links.result) || {}).href ||
      res.data.statusUrl ||
      res.data.jobUrl;
    if (jobUrl) {
      const fullUrl = jobUrl.startsWith('http')
        ? jobUrl
        : `${config.adobe.fireflyApiUrl.replace(/\/$/, '')}${jobUrl}`;
      return pollJob(fullUrl, token);
    }
  }

  if (res.status === 202) {
    const loc = res.headers && res.headers.location;
    const links = res.data && res.data._links;
    const jobUrl =
      loc ||
      (links && (links.self || links.status) && (links.self || links.status).href);
    if (jobUrl) {
      const fullUrl = jobUrl.startsWith('http')
        ? jobUrl
        : `${config.adobe.fireflyApiUrl.replace(/\/$/, '')}${jobUrl}`;
      return pollJob(fullUrl, token);
    }
  }

  const err = new Error(
    `Firefly request failed (${res.status}): ${
      typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
    }`
  );
  err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
  err.details = res.data;
  throw err;
}

module.exports = { generateImage };
