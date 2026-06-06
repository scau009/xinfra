import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { query } from '../db.js';
import { pushBuildTask } from '../services/queue.js';
import { signToken } from '../middleware/jwtAuth.js';

const router = Router();

// multer config: accept tar.gz uploads up to 100MB
const upload = multer({
  dest: path.join(os.tmpdir(), 'plat-uploads'),
  limits: { fileSize: 100 * 1024 * 1024 },
});

// POST /api/cli/login — API Key login
router.post('/login', apiKeyAuth, (req, res) => {
  const token = signToken({ userId: req.user.userId, username: req.user.username });
  res.json({ token, username: req.user.username });
});

// POST /api/cli/deploy — upload tar.gz and trigger deploy
router.post('/deploy', apiKeyAuth, upload.single('project'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No project file uploaded' });

    const { repoName, framework } = req.body;
    const name = repoName || `cli-project-${Date.now()}`;

    // Find or create project
    let project = await query(
      'SELECT * FROM projects WHERE repo_name=$1 AND user_id=$2',
      [name, req.user.userId]
    );

    if (project.rows.length === 0) {
      const domain = `${name}.${req.user.username}.${process.env.PLATFORM_DOMAIN || 'platform.local'}`;
      project = await query(
        `INSERT INTO projects (user_id, repo_name, source_type, framework, domain)
         VALUES ($1, $2, 'cli', $3, $4) RETURNING *`,
        [req.user.userId, name, framework || null, domain]
      );
    }

    const proj = project.rows[0];

    // Create deploy record
    const deploy = await query(
      `INSERT INTO deploys (project_id, status) VALUES ($1, 'pending') RETURNING *`,
      [proj.id]
    );

    // Push build task with tar file path
    await pushBuildTask({
      deployId: deploy.rows[0].id,
      projectId: proj.id,
      repoName: name,
      sourceType: 'cli',
      tarPath: req.file.path,
      domain: proj.domain,
    });

    res.status(201).json({
      deployId: deploy.rows[0].id,
      message: 'Upload received, build queued',
    });
  } catch (err) {
    console.error('CLI deploy error:', err);
    res.status(500).json({ error: 'Failed to process upload' });
  }
});

export default router;
