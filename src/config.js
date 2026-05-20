'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

function optional(name, fallback) {
  const v = process.env[name];
  return v == null || v === '' ? fallback : v;
}

const config = {
  port: parseInt(optional('PORT', '3001'), 10),
  nodeEnv: optional('NODE_ENV', 'development'),
  uploadDir: path.resolve(
    __dirname,
    '..',
    optional('UPLOAD_DIR', './uploads')
  ),
  maxFileSize: parseInt(optional('MAX_FILE_SIZE', '524288000'), 10),

  openWeatherApiKey: optional('OPENWEATHER_API_KEY', ''),

  adobe: {
    imsUrl: optional('ADOBE_IMS_URL', ''),
    clientId: optional('ADOBE_CLIENT_ID', ''),
    clientSecret: optional('ADOBE_CLIENT_SECRET', ''),
    organizationId: optional('ADOBE_ORGANIZATION_ID', ''),
    fireflyApiUrl: optional('ADOBE_FIREFLY_API_URL', ''),
    photoshopApiUrl: optional('ADOBE_PS_API_URL', ''),
    scopes: 'openid,AdobeID,read_organizations,firefly_api,ff_apis',
  },

  azure: {
    account: optional('AZURE_STORAGE_ACCOUNT', ''),
    container: optional('AZURE_CONTAINER_NAME', ''),
    sasToken: optional('AZURE_SAS_TOKEN', ''),
  },
};

function requireConfig(missing) {
  const err = new Error(
    `Missing required environment variable(s): ${missing.join(
      ', '
    )}. Add them to .env and restart.`
  );
  err.status = 500;
  throw err;
}

config.assertAdobe = function assertAdobe() {
  const missing = [];
  if (!config.adobe.imsUrl) missing.push('ADOBE_IMS_URL');
  if (!config.adobe.clientId) missing.push('ADOBE_CLIENT_ID');
  if (!config.adobe.clientSecret) missing.push('ADOBE_CLIENT_SECRET');
  if (missing.length) requireConfig(missing);
};

config.assertFirefly = function assertFirefly() {
  config.assertAdobe();
  if (!config.adobe.fireflyApiUrl) requireConfig(['ADOBE_FIREFLY_API_URL']);
};

config.assertPhotoshop = function assertPhotoshop() {
  config.assertAdobe();
  if (!config.adobe.photoshopApiUrl) requireConfig(['ADOBE_PS_API_URL']);
};

config.assertAzure = function assertAzure() {
  const missing = [];
  if (!config.azure.account) missing.push('AZURE_STORAGE_ACCOUNT');
  if (!config.azure.container) missing.push('AZURE_CONTAINER_NAME');
  if (!config.azure.sasToken) missing.push('AZURE_SAS_TOKEN');
  if (missing.length) requireConfig(missing);
};

config.assertOpenWeather = function assertOpenWeather() {
  if (!config.openWeatherApiKey) requireConfig(['OPENWEATHER_API_KEY']);
};

module.exports = config;
