'use strict';

const { getWeather } = require('../services/weatherService');
const firefly = require('../services/fireflyService');
const photoshop = require('../services/photoshopService');
const { buildPrompt } = require('./styleRules');
const azure = require('../services/azureStorage');

function noop() {}

async function run(input, onStep = noop) {
  const {
    city,
    templateUrl,
    brandImageUrls = [],
    textFields = [],
    brandContext = '',
    outputType = 'image/jpeg',
  } = input;

  const steps = [];
  function step(name, payload = {}) {
    const entry = { name, at: new Date().toISOString(), ...payload };
    steps.push(entry);
    try {
      onStep(entry);
    } catch (e) {
      // swallow listener errors
    }
  }

  step('started', { city });

  const weather = await getWeather(city);
  step('weather_fetched', {
    city: weather.city,
    main: weather.main,
    description: weather.description,
    temp: weather.temp,
  });

  const { prompt, contentClass, rule } = buildPrompt({
    city: weather.city,
    weather,
    brandContext,
    userTextFields: textFields,
  });
  step('prompt_built', { prompt, rule });

  const weatherImageUrl = await firefly.generateImage({
    prompt,
    contentClass,
  });
  step('firefly_done', { weatherImageUrl });

  const outputExt = outputType === 'image/png' ? 'png' : 'jpg';
  const minted = azure.mintOutputUrl(`composed-${Date.now()}.${outputExt}`);
  step('output_url_minted', { outputBlob: minted.blobName });

  const psResult = await photoshop.composeTemplate({
    templateUrl,
    weatherImageUrl,
    brandImageUrls,
    textEdits: textFields,
    outputUrl: minted.url,
    outputType,
  });
  step('photoshop_done', { outputUrl: minted.url });

  return {
    outputUrl: minted.url,
    outputBlob: minted.blobName,
    weatherImageUrl,
    weather,
    promptUsed: prompt,
    layers: psResult.layers,
    steps,
  };
}

module.exports = { run };
