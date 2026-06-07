import { Router } from 'express';
import { jwtAuth } from '../middleware/jwtAuth.js';
import { query } from '../db.js';
import { pushBuildTask, pushCleanupTask, pushStopTask, deleteBuildLogs } from '../services/queue.js';
import { encryptEnvVar } from '../services/crypto.js';

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
    // Duplicate domain or repo name — project already exists
    if (err.code === '23505' && err.constraint === 'projects_domain_key') {
      return res.status(409).json({
        error: `A project with domain "${domain}" already exists. Delete it first or use a different repo name.`,
      });
    }
    if (err.code === '23505') {
      return res.status(409).json({ error: `Project "${repoName}" already exists.` });
    }
    res.status(500).json({ error: err.message || 'Failed to create project' });
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

// POST /api/projects/:id/stop — stop a running project
router.post('/:id/stop', jwtAuth, async (req, res) => {
  try {
    const project = await query(
      'SELECT * FROM projects WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.userId]
    );
    if (project.rows.length === 0) return res.status(404).json({ error: 'Project not found' });

    const { id: projectId, repo_name: repoName } = project.rows[0];

    // Find running deploy
    const running = await query(
      "SELECT id FROM deploys WHERE project_id=$1 AND status='running' ORDER BY created_at DESC LIMIT 1",
      [projectId]
    );
    if (running.rows.length === 0) {
      return res.status(400).json({ error: 'No running deploy to stop' });
    }

    // Push stop task to deploy-scheduler
    await pushStopTask({ projectId, repoName });

    // Mark deploy as stopped
    await query("UPDATE deploys SET status='stopped', finished_at=NOW() WHERE id=$1", [running.rows[0].id]);

    res.json({ stopped: true });
  } catch (err) {
    console.error('Stop project error:', err);
    res.status(500).json({ error: 'Failed to stop project' });
  }
});

// DELETE /api/projects/:id — delete a project and all related resources
router.delete('/:id', jwtAuth, async (req, res) => {
  try {
    // Verify ownership
    const project = await query(
      'SELECT * FROM projects WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.userId]
    );
    if (project.rows.length === 0) return res.status(404).json({ error: 'Project not found' });

    const { id: projectId, repo_name: repoName } = project.rows[0];

    // Collect deploy info for cleanup
    const deploys = await query(
      'SELECT id, image_tag FROM deploys WHERE project_id=$1',
      [projectId]
    );
    const deployIds = deploys.rows.map(d => d.id);
    const images = [...new Set(deploys.rows.map(d => d.image_tag).filter(Boolean))];

    // Push cleanup task to deploy-scheduler (stop container, remove images)
    await pushCleanupTask({
      projectId,
      repoName,
      images,
      deployIds,
    });

    // Delete child rows (env_vars and deploys don't have ON DELETE CASCADE)
    await query('DELETE FROM env_vars WHERE project_id=$1', [projectId]);
    await query('DELETE FROM deploys WHERE project_id=$1', [projectId]);

    // Delete the project itself
    await query('DELETE FROM projects WHERE id=$1', [projectId]);

    // Clean up Redis build log keys
    await deleteBuildLogs(deployIds);

    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// GET /api/projects/:id/env — list env vars (keys only, values masked)
router.get('/:id/env', jwtAuth, async (req, res) => {
  try {
    const project = await query('SELECT * FROM projects WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.userId]);
    if (project.rows.length === 0) return res.status(404).json({ error: 'Project not found' });

    const vars = await query('SELECT id, key FROM env_vars WHERE project_id=$1 ORDER BY key',
      [req.params.id]);
    res.json(vars.rows);
  } catch (err) {
    console.error('List env vars error:', err);
    res.status(500).json({ error: 'Failed to list env vars' });
  }
});

// POST /api/projects/:id/env — add or update env var
router.post('/:id/env', jwtAuth, async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'key is required' });

    const project = await query('SELECT * FROM projects WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.userId]);
    if (project.rows.length === 0) return res.status(404).json({ error: 'Project not found' });

    const encrypted = encryptEnvVar(value || '');
    await query(
      `INSERT INTO env_vars (project_id, key, encrypted_value)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id, key) DO UPDATE SET encrypted_value=$3`,
      [req.params.id, key, encrypted]
    );
    res.status(201).json({ key, updated: true });
  } catch (err) {
    console.error('Set env var error:', err);
    res.status(500).json({ error: 'Failed to set env var' });
  }
});

// DELETE /api/projects/:id/env/:key — delete env var
router.delete('/:id/env/:key', jwtAuth, async (req, res) => {
  try {
    const project = await query('SELECT * FROM projects WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.userId]);
    if (project.rows.length === 0) return res.status(404).json({ error: 'Project not found' });

    const key = decodeURIComponent(req.params.key);
    await query('DELETE FROM env_vars WHERE project_id=$1 AND key=$2', [req.params.id, key]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete env var error:', err);
    res.status(500).json({ error: 'Failed to delete env var' });
  }
});

export default router;
