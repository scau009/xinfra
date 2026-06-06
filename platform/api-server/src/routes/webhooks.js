import { Router } from 'express';
import crypto from 'crypto';
import { query } from '../db.js';
import { pushBuildTask } from '../services/queue.js';

const router = Router();

// POST /api/webhooks/github — receive GitHub push webhook
router.post('/github', async (req, res) => {
  try {
    // Verify HMAC signature
    const signature = req.headers['x-hub-signature-256'];
    const payload = JSON.stringify(req.body);
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    if (secret) {
      const expectedSig = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(signature || ''))) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // Only handle push events
    const event = req.headers['x-github-event'];
    if (event !== 'push') {
      return res.status(200).json({ message: 'Ignored non-push event' });
    }

    const { repository, head_commit, ref } = req.body;
    const repoUrl = repository.clone_url;
    const branch = ref.replace('refs/heads/', '');
    const commitSha = head_commit?.id;

    // Find project linked to this repo
    const project = await query('SELECT * FROM projects WHERE repo_url=$1', [repoUrl]);
    if (project.rows.length === 0) {
      return res.status(200).json({ message: 'No project for this repo' });
    }

    // Create deploy record
    const deploy = await query(
      `INSERT INTO deploys (project_id, commit_sha, status) VALUES ($1, $2, 'pending') RETURNING *`,
      [project.rows[0].id, commitSha]
    );

    // Push build task
    await pushBuildTask({
      deployId: deploy.rows[0].id,
      projectId: project.rows[0].id,
      repoUrl: project.rows[0].repo_url,
      repoName: project.rows[0].repo_name,
      sourceType: project.rows[0].source_type,
      branch,
      commitSha,
      domain: project.rows[0].domain,
    });

    res.status(200).json({ message: 'Build queued', deployId: deploy.rows[0].id });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(200).json({ error: 'Internal error' });
  }
});

export default router;
