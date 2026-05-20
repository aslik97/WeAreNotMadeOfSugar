'use strict';

const axios = require('axios');
const config = require('../config');
const { getAccessToken, getApiKey } = require('../auth/adobeAuth');

function buildLayerEdits({
  weatherImageUrl,
  weatherLayerName = 'weatherBg',
  brandImageUrls = [],
  textEdits = [],
}) {
  const edits = [];

  if (weatherImageUrl) {
    edits.push({
      edit: {},
      name: weatherLayerName,
      input: { href: weatherImageUrl, storage: 'external' },
    });
  }

  brandImageUrls.forEach((url, idx) => {
    if (!url) return;
    edits.push({
      edit: {},
      name: `brand${idx + 1}`,
      input: { href: url, storage: 'external' },
    });
  });

  textEdits.forEach((t) => {
    if (!t || !t.layerName || typeof t.text !== 'string') return;
    edits.push({
      edit: {},
      name: t.layerName,
      text: { content: t.text },
    });
  });

  return edits;
}

async function pollJob(jobUrl, token) {
  const deadline = Date.now() + 300 * 1000;
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
        `Photoshop job poll failed (${res.status}): ${JSON.stringify(res.data)}`
      );
      err.status = 502;
      throw err;
    }
    const body = res.data || {};
    const outputs = Array.isArray(body.outputs) ? body.outputs : [];
    const first = outputs[0] || {};
    const status = (first.status || body.status || '').toLowerCase();
    lastStatus = status;
    if (status === 'succeeded' || status === 'success') {
      return body;
    }
    if (status === 'failed' || status === 'error') {
      const errs = first.errors || body.errors || body.error || body;
      const e = new Error(
        `Photoshop job failed: ${JSON.stringify(errs)}`
      );
      e.status = 502;
      e.details = body;
      throw e;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  const err = new Error(
    `Photoshop job timed out (last status: ${lastStatus || 'unknown'})`
  );
  err.status = 504;
  throw err;
}

async function composeTemplate({
  templateUrl,
  weatherImageUrl,
  brandImageUrls = [],
  textEdits = [],
  outputUrl,
  outputType = 'image/jpeg',
}) {
  if (!templateUrl) {
    const err = new Error('templateUrl is required');
    err.status = 400;
    throw err;
  }
  if (!outputUrl) {
    const err = new Error('outputUrl is required');
    err.status = 400;
    throw err;
  }
  config.assertPhotoshop();

  const token = await getAccessToken();
  const url = `${config.adobe.photoshopApiUrl.replace(
    /\/$/,
    ''
  )}/pie/psdService/documentOperations`;

  const layers = buildLayerEdits({
    weatherImageUrl,
    brandImageUrls,
    textEdits,
  });

  const body = {
    inputs: [{ href: templateUrl, storage: 'external' }],
    options: { layers },
    outputs: [
      {
        href: outputUrl,
        storage: 'external',
        type: outputType,
      },
    ],
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

  if (res.status < 200 || res.status >= 300) {
    const err = new Error(
      `Photoshop documentOperations failed (${res.status}): ${
        typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
      }`
    );
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    err.details = res.data;
    throw err;
  }

  const links = res.data && res.data._links;
  const jobUrl =
    (links && links.self && links.self.href) ||
    res.data.statusUrl ||
    res.data.jobUrl;
  if (!jobUrl) {
    const err = new Error(
      'Photoshop response missing job URL (_links.self.href)'
    );
    err.status = 502;
    err.details = res.data;
    throw err;
  }
  const fullUrl = jobUrl.startsWith('http')
    ? jobUrl
    : `${config.adobe.photoshopApiUrl.replace(/\/$/, '')}${jobUrl}`;

  const finalBody = await pollJob(fullUrl, token);
  return {
    job: finalBody,
    outputUrl,
    layers,
  };
}

module.exports = { composeTemplate, buildLayerEdits };
