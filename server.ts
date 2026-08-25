import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { 
  enqueueVideoJob, 
  getJob, 
  getAllJobs, 
  registerServerAsset,
  listServerAssets,
  getServerAsset,
  upsertServerProject,
  listServerProjects,
  getServerProject,
  CreateVideoParams 
} from './services/serverVideoEngine';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middlewares
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'X-Requested-With'],
  }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // ==========================================================================
  // SERVER-SIDE VIDEO CREATION API ENDPOINTS (STEP 2)
  // ==========================================================================

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      ok: true,
      service: 'Vixora Video Engine API',
      status: 'operational',
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /api/public/v1/videos/create & POST /api/videos/create
   * Accepts: { project_id, script, topic, voice, aspect_ratio, duration, resolution, format }
   * Returns: { ok: true, job_id, status: "queued", message, estimated_seconds }
   */
  const handleVideoCreate = async (req: express.Request, res: express.Response) => {
    try {
      const { 
        project_id, 
        script, 
        topic, 
        voice, 
        aspect_ratio, 
        duration, 
        resolution, 
        format 
      } = req.body || {};

      if (!script && !topic) {
        return res.status(400).json({
          ok: false,
          error: 'Validation failed: Either "script" or "topic" must be provided in request body.',
        });
      }

      const params: CreateVideoParams = {
        project_id: project_id || `proj_${Date.now()}`,
        script: typeof script === 'string' ? script.trim() : undefined,
        topic: typeof topic === 'string' ? topic.trim() : undefined,
        voice: voice || 'Aoede',
        aspect_ratio: aspect_ratio === 'horizontal' ? 'horizontal' : aspect_ratio === 'square' ? 'square' : 'vertical',
        duration: duration || '30s',
        resolution: resolution || '1080p',
        format: format || 'mp4',
      };

      const job = enqueueVideoJob(params);

      return res.status(202).json({
        ok: true,
        job_id: job.job_id,
        project_id: job.project_id,
        status: job.status,
        progress: job.progress,
        current_step: job.current_step,
        created_at: job.created_at,
        links: {
          status: `/api/public/v1/videos/status?job_id=${job.job_id}`,
        },
        message: 'Server-side video creation job initiated successfully.',
      });
    } catch (err: any) {
      console.error('[API /videos/create Error]:', err);
      return res.status(500).json({
        ok: false,
        error: err?.message || 'Failed to initialize server-side video creation job',
      });
    }
  };

  app.post('/api/public/v1/videos/create', handleVideoCreate);
  app.post('/api/videos/create', handleVideoCreate);
  app.post('/videos/create', handleVideoCreate);

  /**
   * GET /api/public/v1/videos/status & GET /api/videos/status
   * Query param: ?job_id=...
   * Returns: { ok: true, job_id, status: "queued"|"processing"|"ready"|"failed", progress, current_step, asset_id, video_url, error, logs }
   */
  const handleVideoStatus = async (req: express.Request, res: express.Response) => {
    try {
      const jobId = (req.query.job_id as string) || (req.query.id as string) || (req.body?.job_id as string);
      
      if (!jobId) {
        return res.status(400).json({
          ok: false,
          error: 'Query parameter "job_id" is required (e.g. /api/public/v1/videos/status?job_id=job_123).',
        });
      }

      const job = getJob(jobId);

      if (!job) {
        return res.status(404).json({
          ok: false,
          error: `Job with ID "${jobId}" was not found or has expired.`,
        });
      }

      return res.json({
        ok: true,
        job_id: job.job_id,
        project_id: job.project_id,
        status: job.status,
        progress: job.progress,
        current_step: job.current_step,
        asset_id: job.asset_id || null,
        video_url: job.video_url || null,
        thumbnail_url: job.thumbnail_url || null,
        error: job.error || null,
        created_at: job.created_at,
        updated_at: job.updated_at,
        completed_at: job.completed_at || null,
        logs: job.logs,
      });
    } catch (err: any) {
      console.error('[API /videos/status Error]:', err);
      return res.status(500).json({
        ok: false,
        error: err?.message || 'Error retrieving video job status',
      });
    }
  };

  app.get('/api/public/v1/videos/status', handleVideoStatus);
  app.get('/api/videos/status', handleVideoStatus);
  app.get('/videos/status', handleVideoStatus);
  app.post('/api/public/v1/videos/status', handleVideoStatus);
  app.post('/api/videos/status', handleVideoStatus);
  app.post('/videos/status', handleVideoStatus);

  /**
   * GET /api/public/v1/videos/list
   * Returns list of recent server-generated video jobs
   */
  const handleVideosList = (req: express.Request, res: express.Response) => {
    const jobs = getAllJobs();
    res.json({
      ok: true,
      count: jobs.length,
      jobs: jobs.map(j => ({
        job_id: j.job_id,
        project_id: j.project_id,
        status: j.status,
        progress: j.progress,
        topic: j.topic,
        asset_id: j.asset_id,
        video_url: j.video_url,
        created_at: j.created_at,
      })),
    });
  };

  app.get('/api/public/v1/videos/list', handleVideosList);
  app.get('/api/videos/list', handleVideosList);
  app.get('/videos/list', handleVideosList);

  /**
   * POST /assets/create, POST /api/assets/create, POST /api/public/v1/assets/create
   */
  const handleAssetCreate = (req: express.Request, res: express.Response) => {
    try {
      const { id, project_id, name, type, url, format, duration, resolution, metadata } = req.body || {};
      const assetId = id || `asset_${Date.now()}`;
      
      const asset = registerServerAsset({
        id: assetId,
        project_id: project_id || `proj_${Date.now()}`,
        name: name || 'Video Asset',
        type: type || 'video',
        url: url || '',
        format: format || 'mp4',
        duration: duration || '30s',
        resolution: resolution || '1080p',
        metadata: metadata || {},
      });

      return res.status(201).json({
        ok: true,
        asset,
        data: asset,
        message: 'Asset registered successfully',
      });
    } catch (err: any) {
      console.error('[API /assets/create Error]:', err);
      return res.status(500).json({
        ok: false,
        error: err?.message || 'Failed to register asset',
      });
    }
  };

  app.post('/api/public/v1/assets/create', handleAssetCreate);
  app.post('/api/assets/create', handleAssetCreate);
  app.post('/assets/create', handleAssetCreate);

  /**
   * GET /projects/list, POST /projects/list, GET /api/projects/list
   * Supports ?include_assets=true and ?project_id=...
   */
  const handleProjectsList = (req: express.Request, res: express.Response) => {
    try {
      const includeAssets = req.query.include_assets === 'true' || req.body?.include_assets === true;
      const projectId = (req.query.project_id as string) || req.body?.project_id;

      if (projectId) {
        const project = getServerProject(projectId, includeAssets);
        return res.json({
          ok: true,
          projects: project ? [project] : [],
          data: project ? [project] : [],
        });
      }

      const projects = listServerProjects(includeAssets);
      return res.json({
        ok: true,
        count: projects.length,
        projects,
        data: projects,
      });
    } catch (err: any) {
      console.error('[API /projects/list Error]:', err);
      return res.status(500).json({
        ok: false,
        error: err?.message || 'Failed to fetch projects list',
      });
    }
  };

  app.get('/api/public/v1/projects/list', handleProjectsList);
  app.post('/api/public/v1/projects/list', handleProjectsList);
  app.get('/api/projects/list', handleProjectsList);
  app.post('/api/projects/list', handleProjectsList);
  app.get('/projects/list', handleProjectsList);
  app.post('/projects/list', handleProjectsList);

  /**
   * POST /projects/create
   */
  const handleProjectCreate = (req: express.Request, res: express.Response) => {
    try {
      const { id, title, topic, status, aspect_ratio, target_duration, script_text, voiceover_url, video_url } = req.body || {};
      const projId = id || `proj_${Date.now()}`;
      const project = upsertServerProject({
        id: projId,
        title: title || topic || 'New Project',
        topic,
        status: status || 'draft',
        aspect_ratio,
        target_duration,
        script_text,
        voiceover_url,
        video_url,
      });

      return res.status(201).json({
        ok: true,
        project,
        data: project,
        message: 'Project created successfully',
      });
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        error: err?.message || 'Failed to create project',
      });
    }
  };

  app.post('/api/public/v1/projects/create', handleProjectCreate);
  app.post('/api/projects/create', handleProjectCreate);
  app.post('/projects/create', handleProjectCreate);

  /**
   * GET /api/public/v1/assets/download/:filename
   * Streams or downloads the generated MP4 video file
   */
  const handleAssetDownload = (req: express.Request, res: express.Response) => {
    const rawFilename = req.params.filename;
    const filename = Array.isArray(rawFilename) ? rawFilename[0] : (rawFilename || '');
    const sanitizedFilename = path.basename(filename);
    const assetPath = path.join('/tmp', 'vixora_assets', sanitizedFilename);

    if (fs.existsSync(assetPath)) {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `inline; filename="${sanitizedFilename}"`);
      return res.sendFile(assetPath);
    }

    // Fallback: check project root or redirect to curated fallback
    return res.status(404).json({
      ok: false,
      error: `Asset file "${sanitizedFilename}" not found on server.`,
    });
  };

  app.get('/api/public/v1/assets/download/:filename', handleAssetDownload);
  app.get('/api/assets/download/:filename', handleAssetDownload);
  app.get('/assets/download/:filename', handleAssetDownload);

  // ==========================================================================
  // VITE DEV MIDDLEWARE & PRODUCTION STATIC SERVING
  // ==========================================================================

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Vixora Server] Video Engine running on http://0.0.0.0:${PORT}`);
    console.log(`[Vixora Server] Endpoints: POST /api/public/v1/videos/create, GET /api/public/v1/videos/status`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
