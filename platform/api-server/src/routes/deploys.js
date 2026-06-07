import { Router } from 'express';
import { jwtAuth } from '../middleware/jwtAuth.js';
import { query } from '../db.js';
import { getBuildLogs } from '../services/queue.js';

const router = Router();

// GET /api/deploys/:id — query deploy status
router.get('/:id', jwtAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT d.*, p.user_id FROM deploys d
       JOIN projects p ON d.project_id = p.id
       WHERE d.id=$1 AND p.user_id=$2`,
      [req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Deploy not found' });

    const deploy = result.rows[0];
    delete deploy.user_id;
    res.json(deploy);
  } catch (err) {
    console.error('Get deploy error:', err);
    res.status(500).json({ error: 'Failed to get deploy' });
  }
});

// GET /api/deploys/:id/logs — SSE real-time log stream
router.get('/:id/logs', jwtAuth, async (req, res) => {
  const deployId = req.params.id;

  // Verify ownership
  const deploy = await query(
    `SELECT d.*, p.user_id FROM deploys d
     JOIN projects p ON d.project_id = p.id
     WHERE d.id=$1 AND p.user_id=$2`,
    [deployId, req.user.userId]
  );
  if (deploy.rows.length === 0) {
    return res.status(404).json({ error: 'Deploy not found' });
  }

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send existing log_text from DB first
  const logText = deploy.rows[0].log_text || '';
  if (logText) {
    // Split by newlines and send each line
    for (const line of logText.split('\n')) {
      if (line) res.write(`data: ${JSON.stringify({ type: 'log', line })}\n\n`);
    }
  }

  let lastIndex = 0;
  let completed = false;

  // Poll Redis for log lines (non-destructive LRANGE)
  const interval = setInterval(async () => {
    try {
      const current = await query('SELECT status FROM deploys WHERE id=$1', [deployId]);
      if (current.rows.length === 0) {
        clearInterval(interval);
        res.end();
        return;
      }

      // Get all new lines since last index (non-destructive)
      const lines = await getBuildLogs(deployId, lastIndex);
      if (lines && lines.length > 0) {
        for (const line of lines) {
          res.write(`data: ${JSON.stringify({ type: 'log', line })}\n\n`);
        }
        lastIndex += lines.length;
      }

      const status = current.rows[0].status;
      if ((status === 'running' || status === 'failed') && !completed) {
        completed = true;
        // One final sweep for any remaining lines
        const final = await getBuildLogs(deployId, lastIndex);
        if (final && final.length > 0) {
          for (const line of final) {
            res.write(`data: ${JSON.stringify({ type: 'log', line })}\n\n`);
          }
        }
        res.write(`data: ${JSON.stringify({ type: 'done', status })}\n\n`);
        clearInterval(interval);
        res.end();
      }
    } catch (err) {
      console.error('SSE stream error:', err);
      clearInterval(interval);
      res.end();
    }
  }, 500);

  req.on('close', () => {
    clearInterval(interval);
  });
});

export default router;
