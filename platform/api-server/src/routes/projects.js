import { Router } from 'express';
import { jwtAuth } from '../middleware/jwtAuth.js';
import { query } from '../db.js';
import { pushBuildTask } from '../services/queue.js';

const router = Router();

// GET /api/projects — list all projects for current user
router.get('/', jwtAuth, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM projects WHERE user_id=$1 ORDER BY created_at DESC',
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List projects error:', err);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// POST /api/projects — create a project
router.post('/', jwtAuth, async (req, res) => {
  try {
    const { repoUrl, repoName, sourceType } = req.body;
    if (!repoName) return res.status(400).json({ error: 'repoName is required' });

    const domain = `${repoName}.${req.user.username}.${process.env.PLATFORM_DOMAIN || 'platform.local'}`;

    const result = await query(
      `INSERT INTO projects (user_id, repo_url, repo_name, source_type, domain)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.userId, repoUrl || null, repoName, sourceType || 'github', domain]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// GET /api/projects/:id — project detail + deploy history
router.get('/:id', jwtAuth, async (req, res) => {
  try {
    const project = await query(
      'SELECT * FROM projects WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.userId]
    );
    if (project.rows.length === 0) return res.status(404).json({ error: 'Project not found' });

    const deploys = await query(
      'SELECT * FROM deploys WHERE project_id=$1 ORDER BY created_at DESC LIMIT 20',
      [req.params.id]
    );

    res.json({ ...project.rows[0], deploys: deploys.rows });
  } catch (err) {
    console.error('Get project error:', err);
    res.status(500).json({ error: 'Failed to get project' });
  }
});

// POST /api/projects/:id/deploy — manual deploy trigger
router.post('/:id/deploy', jwtAuth, async (req, res) => {
  try {
    const project = await query(
      'SELECT * FROM projects WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.userId]
    );
    if (project.rows.length === 0) return res.status(404).json({ error: 'Project not found' });

    const deploy = await query(
      `INSERT INTO deploys (project_id, status) VALUES ($1, 'pending') RETURNING *`,
      [req.params.id]
    );

    await pushBuildTask({
      deployId: deploy.rows[0].id,
      projectId: project.rows[0].id,
      repoUrl: project.rows[0].repo_url,
      repoName: project.rows[0].repo_name,
      sourceType: project.rows[0].source_type,
      domain: project.rows[0].domain,
    });

    res.status(201).json(deploy.rows[0]);
  } catch (err) {
    console.error('Deploy error:', err);
    res.status(500).json({ error: 'Failed to trigger deploy' });
  }
});

// DELETE /api/projects/:id — delete a project
router.delete('/:id', jwtAuth, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM projects WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;
