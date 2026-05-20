'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { BlobServiceClient } = require('@azure/storage-blob');

const config = require('../config');

function makeServiceClient() {
  config.assertAzure();
  const sas = config.azure.sasToken.startsWith('?')
    ? config.azure.sasToken
    : `?${config.azure.sasToken}`;
  const url = `https://${config.azure.account}.blob.core.windows.net${sas}`;
  return new BlobServiceClient(url);
}

function makeBlobUrl(blobName) {
  config.assertAzure();
  const sas = config.azure.sasToken.startsWith('?')
    ? config.azure.sasToken
    : `?${config.azure.sasToken}`;
  return `https://${config.azure.account}.blob.core.windows.net/${encodeURIComponent(
    config.azure.container
  )}/${encodeURI(blobName)}${sas}`;
}

function pickContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.psd':
      return 'image/vnd.adobe.photoshop';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

async function uploadFile(localPath, options = {}) {
  const filename = path.basename(localPath);
  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, '_');
  const prefix = options.prefix || 'weather-app';
  const id = options.id || crypto.randomBytes(6).toString('hex');
  const blobName = `${prefix}/${id}-${safe}`;

  const service = makeServiceClient();
  const container = service.getContainerClient(config.azure.container);
  const block = container.getBlockBlobClient(blobName);

  await block.uploadFile(localPath, {
    blobHTTPHeaders: { blobContentType: pickContentType(filename) },
  });

  return {
    blobName,
    url: makeBlobUrl(blobName),
  };
}

async function uploadBuffer(buffer, filename, options = {}) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, '_');
  const prefix = options.prefix || 'weather-app';
  const id = options.id || crypto.randomBytes(6).toString('hex');
  const blobName = `${prefix}/${id}-${safe}`;

  const service = makeServiceClient();
  const container = service.getContainerClient(config.azure.container);
  const block = container.getBlockBlobClient(blobName);

  await block.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: options.contentType || pickContentType(filename),
    },
  });

  return {
    blobName,
    url: makeBlobUrl(blobName),
  };
}

function mintOutputUrl(filename, options = {}) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, '_');
  const prefix = options.prefix || 'weather-app/outputs';
  const id = options.id || crypto.randomBytes(6).toString('hex');
  const blobName = `${prefix}/${id}-${safe}`;
  return { blobName, url: makeBlobUrl(blobName) };
}

async function downloadToFile(blobName, destPath) {
  const service = makeServiceClient();
  const container = service.getContainerClient(config.azure.container);
  const block = container.getBlockBlobClient(blobName);
  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
  await block.downloadToFile(destPath);
  return destPath;
}

module.exports = {
  uploadFile,
  uploadBuffer,
  mintOutputUrl,
  downloadToFile,
  makeBlobUrl,
};
