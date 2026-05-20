'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');

const upload = require('../middleware/upload');
const azure = require('../services/azureStorage');
const weatherAgent = require('../agent/weatherAgent');

const router = express.Router();

const jobs = new Map();

function newJob() {
  const id = crypto.randomUUID();
  const job = {
    id,
    createdAt: Date.now(),
    status: 'pending',
    steps: [],
    listeners: new Set(),
    result: null,
    error: null,
  };
  jobs.set(id, job);
  // Light auto-clean after 1h
  setTimeout(() => jobs.delete(id), 60 * 60 * 1000).unref();
  return job;
}

function pushStep(job, step) {
  job.steps.push(step);
  for (const send of job.listeners) {
    try {
      send({ event: 'step', data: step });
    } catch (e) {
      // ignore
    }
  }
}

function finishJob(job, status, payload) {
  job.status = status;
  if (status === 'succeeded') job.result = payload;
  if (status === 'failed') job.error = payload;
  const evt = status === 'succeeded' ? 'done' : 'error';
  for (const send of job.listeners) {
    try {
      send({ event: evt, data: payload });
    } catch (e) {
      // ignore
    }
  }
  job.listeners.clear();
}

function cleanupFiles(files) {
  if (!files) return;
  const list = Array.isArray(files) ? files : Object.values(files).flat();
  for (const f of list) {
    if (f && f.path) {
      fs.promises.unlink(f.path).catch(() => {});
    }
  }
}

function parseTextFields(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => ({
        layerName: String((entry && entry.layerName) || '').trim(),
        text: typeof (entry && entry.text) === 'string' ? entry.text : '',
      }))
      .filter((e) => e.layerName.length > 0);
  } catch (e) {
    return [];
  }
}

router.post(
  '/',
  upload.fields([
    { name: 'images', maxCount: 20 },
    { name: 'template', maxCount: 1 },
  ]),
  async (req, res) => {
    const files = req.files || {};
    const images = files.images || [];
    const templateFile = (files.template || [])[0];

    const city = String((req.body && req.body.city) || '').trim();
    const brandContext = String((req.body && req.body.brandContext) || '').trim();
    const outputType =
      (req.body && req.body.outputType) === 'image/png'
        ? 'image/png'
        : 'image/jpeg';
    const textFields = parseTextFields(req.body && req.body.textFields);

    if (!city) {
      cleanupFiles(files);
      return res.status(400).json({ error: 'city is required' });
    }
    if (!templateFile) {
      cleanupFiles(files);
      return res.status(400).json({ error: 'template (PSD) is required' });
    }
    const ext = path.extname(templateFile.originalname).toLowerCase();
    if (ext !== '.psd') {
      cleanupFiles(files);
      return res
        .status(400)
        .json({ error: `Unsupported template extension: ${ext}. Use .psd` });
    }

    const job = newJob();

    res.status(202).json({
      jobId: job.id,
      streamUrl: `/api/generate/stream/${job.id}`,
      status: job.status,
    });

    (async () => {
      try {
        pushStep(job, {
          name: 'uploading_inputs',
          at: new Date().toISOString(),
          imageCount: images.length,
        });

        const templateUpload = await azure.uploadFile(templateFile.path, {
          prefix: 'weather-app/templates',
        });
        const brandUploads = [];
        for (const img of images) {
          const up = await azure.uploadFile(img.path, {
            prefix: 'weather-app/brand',
          });
          brandUploads.push(up.url);
        }
        pushStep(job, {
          name: 'inputs_uploaded',
          at: new Date().toISOString(),
          templateUrl: templateUpload.url,
          brandUrls: brandUploads,
        });

        const result = await weatherAgent.run(
          {
            city,
            templateUrl: templateUpload.url,
            brandImageUrls: brandUploads,
            textFields,
            brandContext,
            outputType,
          },
          (step) => pushStep(job, step)
        );

        finishJob(job, 'succeeded', result);
      } catch (err) {
        console.error('[generate] job failed:', err);
        finishJob(job, 'failed', {
          message: err.message || 'Job failed',
          details: err.details || null,
        });
      } finally {
        cleanupFiles(files);
      }
    })();
  }
);

router.get('/stream/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'job not found' });

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders && res.flushHeaders();

  const send = ({ event, data }) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  for (const step of job.steps) {
    send({ event: 'step', data: step });
  }
  if (job.status === 'succeeded') {
    send({ event: 'done', data: job.result });
    return res.end();
  }
  if (job.status === 'failed') {
    send({ event: 'error', data: job.error });
    return res.end();
  }

  job.listeners.add((evt) => {
    send(evt);
    if (evt.event === 'done' || evt.event === 'error') {
      res.end();
    }
  });

  req.on('close', () => {
    // listener auto-clears when job finishes; here we just no-op
  });
});

router.get('/job/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'job not found' });
  res.json({
    id: job.id,
    status: job.status,
    steps: job.steps,
    result: job.result,
    error: job.error,
  });
});

module.exports = router;
