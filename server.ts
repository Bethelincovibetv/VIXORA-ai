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
  CreateVideoParams,
  getGemini,
  CURATED_STOCK_VIDEOS,
  BGM_TRACKS
} from './services/serverVideoEngine';
import { PRESET_SFX_CATALOG } from './sfxLibrary';
import { SERVER_MUSIC_TRACKS, SERVER_VOICE_OPTIONS } from './services/serverCatalog';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middlewares & CORS (Permissive for external websites and studio integrations)
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'X-Requested-With', 'X-Project-Id'],
  }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // In-memory synced users store for single-sign on between website and studio
  const syncedUsersStore = new Map<string, any>();

  // In-memory API keys store with initial seed keys
  const serverApiKeysStore = new Map<string, any>([
    [
      'vx_live_vixora_prod_89f3a928b7e411d9c02',
      {
        id: 'key_primary_default',
        name: 'Main Website & Remote Embed Key',
        apiKey: 'vx_live_vixora_prod_89f3a928b7e411d9c02',
        prefix: 'vx_live_vixora_...',
        createdAt: '2026-08-25T00:00:00.000Z',
        lastUsedAt: new Date().toISOString(),
        status: 'active',
        rateLimitPerMin: 120,
        permissions: ['videos:create', 'scripts:generate', 'audio:tts', 'assets:search', 'remote:embed'],
        usageCount: 28,
      }
    ]
  ]);

  // Global API Key & Authentication Tracking Middleware
  app.use((req, res, next) => {
    const authHeader = req.headers['authorization'] || '';
    const customApiKey = req.headers['x-api-key'] || req.headers['apikey'] || req.query['api_key'] || req.query['apiKey'] || '';
    let extractedKey = '';

    if (typeof customApiKey === 'string' && customApiKey.startsWith('vx_')) {
      extractedKey = customApiKey;
    } else if (typeof authHeader === 'string' && authHeader.startsWith('Bearer vx_')) {
      extractedKey = authHeader.replace('Bearer ', '').trim();
    }

    if (extractedKey && serverApiKeysStore.has(extractedKey)) {
      const record = serverApiKeysStore.get(extractedKey);
      record.lastUsedAt = new Date().toISOString();
      record.usageCount = (record.usageCount || 0) + 1;
      (req as any).apiKeyRecord = record;
    }

    next();
  });

  // ==========================================================================
  // SYSTEM HEALTH & CONFIGURATION ENDPOINTS
  // ==========================================================================

  app.get(['/api/health', '/api/public/v1/health'], (req, res) => {
    res.json({
      ok: true,
      service: 'Vixora Studio Universal Video & AI Engine',
      status: 'operational',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      capabilities: [
        'videos_creation',
        'script_generation',
        'voiceover_tts',
        'sfx_library',
        'music_library',
        'stock_media_search',
        'projects_cloud_sync',
        'unified_auth_sync'
      ]
    });
  });

  app.get('/api/public/v1/config', (req, res) => {
    res.json({
      ok: true,
      endpoints: {
        create_video: '/api/public/v1/videos/create',
        video_status: '/api/public/v1/videos/status',
        videos_list: '/api/public/v1/videos/list',
        generate_script: '/api/public/v1/scripts/generate',
        voiceover_tts: '/api/public/v1/audio/tts',
        available_voices: '/api/public/v1/audio/voices',
        sfx_catalog: '/api/public/v1/audio/sfx',
        music_catalog: '/api/public/v1/audio/music',
        stock_search: '/api/public/v1/assets/search',
        projects_list: '/api/public/v1/projects/list',
        projects_create: '/api/public/v1/projects/create',
        assets_create: '/api/public/v1/assets/create',
        auth_sync: '/api/public/v1/auth/sync',
        download_asset: '/api/public/v1/assets/download/:filename'
      },
      supported_aspect_ratios: ['vertical', 'square', 'horizontal'],
      supported_durations: ['15s', '30s', '60s'],
      voices: SERVER_VOICE_OPTIONS.map(v => ({ id: v.id, name: v.name, voiceName: v.voiceName, accent: v.accent, gender: v.gender }))
    });
  });

  // ==========================================================================
  // 1. VIDEO CREATION & RENDERING ENGINE ENDPOINTS
  // ==========================================================================

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
  // 2. AI SCRIPT & SCENE BEATS GENERATION ENDPOINT
  // ==========================================================================

  const handleScriptGenerate = async (req: express.Request, res: express.Response) => {
    try {
      const { topic, duration = '30s', niche = 'general', tone = 'engaging', style = 'viral_short' } = req.body || {};

      if (!topic) {
        return res.status(400).json({
          ok: false,
          error: 'Field "topic" is required to generate script (e.g. { "topic": "3 Rules for Instant Clarity" })'
        });
      }

      const ai = getGemini();
      const prompt = `You are a world-class viral video copywriter and content strategist. 
Write a high-retention script for a ${duration} video on the topic: "${topic}".
Niche: ${niche}. Tone: ${tone}. Style: ${style}.

Return JSON in this EXACT schema:
{
  "title": "Short Catchy Video Title",
  "hook": "The first 3-second scroll-stopping sentence",
  "full_script": "The complete spoken script text (3-5 punchy sentences, ~50-90 words)",
  "beats": [
    {
      "index": 1,
      "text": "Beat sentence text",
      "visual_search_query": "specific keyword search for stock video",
      "sfx_cue": "whoosh" | "pop" | "sparkle" | "sub_drop" | "shutter",
      "suggested_duration": 4
    }
  ],
  "suggested_music_mood": "motivational" | "dramatic" | "calm" | "upbeat" | "corporate" | "tech",
  "target_duration_seconds": ${duration === '15s' ? 15 : duration === '60s' ? 60 : 30}
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });

      const responseText = response.text || '{}';
      let parsed = {};
      try {
        parsed = JSON.parse(responseText);
      } catch {
        parsed = {
          title: topic,
          hook: `Stop scrolling if you want to understand ${topic}.`,
          full_script: `Here is the most important principle behind ${topic}. Master this one fundamental insight and everything else becomes effortless.`,
          beats: [
            { index: 1, text: `Stop scrolling if you want to understand ${topic}.`, visual_search_query: `${topic} intro`, sfx_cue: 'whoosh', suggested_duration: 5 }
          ],
          suggested_music_mood: 'motivational',
          target_duration_seconds: 30
        };
      }

      return res.json({
        ok: true,
        data: parsed,
        script: (parsed as any).full_script || (parsed as any).hook,
        beats: (parsed as any).beats || [],
        title: (parsed as any).title || topic,
        suggested_music_mood: (parsed as any).suggested_music_mood || 'motivational'
      });
    } catch (err: any) {
      console.error('[API /scripts/generate Error]:', err);
      return res.status(500).json({
        ok: false,
        error: err?.message || 'Failed to generate script via Gemini AI'
      });
    }
  };

  app.post('/api/public/v1/scripts/generate', handleScriptGenerate);
  app.post('/api/scripts/generate', handleScriptGenerate);
  app.post('/scripts/generate', handleScriptGenerate);

  // ==========================================================================
  // 3. FISH AUDIO VOICEOVER (TTS) & AUDIO ENDPOINTS
  // ==========================================================================

  const handleAudioTTS = async (req: express.Request, res: express.Response) => {
    try {
      const { text, voice = 'Aoede', speed = 1.0, format = 'mp3', model = 's2.1-pro-free', reference_id, apiKey } = req.body || {};

      if (!text) {
        return res.status(400).json({
          ok: false,
          error: 'Field "text" is required for voiceover synthesis'
        });
      }

      const fishApiKey = apiKey || process.env.FISH_AUDIO_API_KEY || 'sk-fish-xEutEyyFu1FHRG1iw_Ivgpscuo4oxXzpOJQ1YdITcjk';

      // Map voice styles for Fish Audio
      let emotionTag = '[calm]';
      if (voice.toLowerCase().includes('kore')) emotionTag = '[excited] [cheerful]';
      else if (voice.toLowerCase().includes('puck')) emotionTag = '[excited] [energetic]';
      else if (voice.toLowerCase().includes('charon')) emotionTag = '[deep] [serious]';
      else if (voice.toLowerCase().includes('fenrir')) emotionTag = '[confident]';
      else if (voice.toLowerCase().includes('aoede')) emotionTag = '[warm] [calm]';

      const promptText = text.startsWith('[') ? text : `${emotionTag} ${text}`;

      // Call Fish Audio S2.1 Pro Free API
      try {
        const fishRes = await fetch('https://api.fish.audio/v1/tts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${fishApiKey}`,
            'Content-Type': 'application/json',
            'model': model
          },
          body: JSON.stringify({
            text: promptText,
            reference_id: reference_id || undefined,
            format: format === 'wav' ? 'wav' : 'mp3'
          })
        });

        if (fishRes.ok) {
          const arrayBuffer = await fishRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64Audio = buffer.toString('base64');
          const wordCount = text.split(/\s+/).length;
          const estimatedDurationSec = Math.max(3, Math.round((wordCount / 140) * 60 / speed));

          // If client accepts binary stream directly
          if (req.headers.accept?.includes('audio/')) {
            res.setHeader('Content-Type', format === 'wav' ? 'audio/wav' : 'audio/mpeg');
            res.setHeader('Content-Length', buffer.length);
            return res.send(buffer);
          }

          return res.json({
            ok: true,
            provider: 'fish.audio',
            model: model,
            voice,
            text,
            speed,
            estimated_duration_seconds: estimatedDurationSec,
            audio_format: format === 'wav' ? 'wav' : 'mp3',
            audio_base64: base64Audio,
            status: 'ready',
            message: 'Fish Audio S2.1 Pro voiceover synthesized successfully',
            audio_stream_url: `data:audio/mp3;base64,${base64Audio}`
          });
        } else {
          const errBody = await fishRes.text();
          let parsed: any = null;
          try { parsed = JSON.parse(errBody); } catch {}
          console.warn(`[Fish Audio API Warning (${fishRes.status})]:`, parsed?.message || errBody);
          
          return res.status(fishRes.status).json({
            ok: false,
            provider: 'fish.audio',
            status_code: fishRes.status,
            error: parsed?.message || 'Fish Audio synthesis error',
            hint: fishRes.status === 402 ? 'Please add API credit on https://fish.audio/app/developers' : undefined
          });
        }
      } catch (fishFetchErr: any) {
        console.error('[Fish Audio fetch failed]:', fishFetchErr);
        return res.status(500).json({
          ok: false,
          error: fishFetchErr?.message || 'Failed to contact Fish Audio API'
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        error: err?.message || 'Voiceover synthesis failed'
      });
    }
  };

  app.post('/api/fish-audio/tts', handleAudioTTS);
  app.post('/api/public/v1/audio/tts', handleAudioTTS);
  app.post('/api/audio/tts', handleAudioTTS);
  app.post('/api/tts', handleAudioTTS);
  app.post('/audio/tts', handleAudioTTS);

  app.get(['/api/public/v1/audio/voices', '/api/audio/voices', '/audio/voices'], (req, res) => {
    res.json({
      ok: true,
      count: SERVER_VOICE_OPTIONS.length,
      voices: SERVER_VOICE_OPTIONS.map(v => ({
        id: v.id,
        name: v.name,
        voiceName: v.voiceName,
        accent: v.accent,
        gender: v.gender,
        description: v.description,
        sampleText: v.sampleText,
        badge: v.badge || null,
        isVixoraVoice: !!v.isVixoraVoice
      }))
    });
  });

  // ==========================================================================
  // 4. SOUND EFFECTS & MUSIC CATALOG ENDPOINTS
  // ==========================================================================

  app.get(['/api/public/v1/audio/sfx', '/api/audio/sfx', '/audio/sfx'], (req, res) => {
    const category = req.query.category as string;
    let items = PRESET_SFX_CATALOG;
    if (category) {
      items = items.filter(i => i.category === category);
    }
    res.json({
      ok: true,
      count: items.length,
      sfx: items.map(s => ({
        id: s.id,
        name: s.name,
        category: s.category,
        description: s.description,
        type: s.type,
        synthType: s.synthType || null
      }))
    });
  });

  app.get(['/api/public/v1/audio/music', '/api/audio/music', '/audio/music'], (req, res) => {
    const mood = req.query.mood as string;
    let tracks = SERVER_MUSIC_TRACKS;
    if (mood) {
      tracks = tracks.filter(t => t.mood === mood);
    }
    res.json({
      ok: true,
      count: tracks.length,
      tracks: tracks.map(t => ({
        id: t.id,
        name: t.name,
        mood: t.mood,
        description: t.description,
        stream_url: t.url
      }))
    });
  });

  // ==========================================================================
  // 5. STOCK ASSET & MEDIA SEARCH ENDPOINT
  // ==========================================================================

  const handleAssetSearch = (req: express.Request, res: express.Response) => {
    const query = ((req.query.query || req.body?.query || 'nature') as string).toLowerCase();
    const orientation = (req.query.orientation || req.body?.orientation || 'vertical') as string;

    const results = CURATED_STOCK_VIDEOS.map((url, idx) => ({
      id: `stock_${idx + 1}`,
      title: `${query.charAt(0).toUpperCase() + query.slice(1)} Video Clip ${idx + 1}`,
      media_type: 'video',
      preview_url: url,
      download_url: url,
      orientation,
      aspect_ratio: orientation === 'horizontal' ? '16:9' : orientation === 'square' ? '1:1' : '9:16',
      duration: 15
    }));

    res.json({
      ok: true,
      query,
      count: results.length,
      results
    });
  };

  app.get(['/api/public/v1/assets/search', '/api/assets/search', '/assets/search'], handleAssetSearch);
  app.post(['/api/public/v1/assets/search', '/api/assets/search', '/assets/search'], handleAssetSearch);

  // ==========================================================================
  // 6. UNIFIED AUTH & SINGLE SIGN-ON SYNCHRONIZATION ENDPOINT
  // ==========================================================================

  const handleAuthSync = (req: express.Request, res: express.Response) => {
    try {
      const { user_id, email, full_name, access_token, metadata } = req.body || {};

      if (!email && !user_id) {
        return res.status(400).json({
          ok: false,
          error: 'Either "email" or "user_id" is required for authentication sync'
        });
      }

      const syncKey = user_id || email;
      const userProfile = {
        user_id: user_id || `usr_${Date.now()}`,
        email: email || '',
        full_name: full_name || (email ? email.split('@')[0] : 'Creator'),
        session_token: access_token || `vix_tok_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        synced_at: new Date().toISOString(),
        metadata: metadata || {},
        role: 'authenticated_creator',
      };

      syncedUsersStore.set(syncKey, userProfile);

      return res.json({
        ok: true,
        user: userProfile,
        authenticated: true,
        session_token: userProfile.session_token,
        message: 'User session synchronized with Vixora Studio cloud database successfully.'
      });
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        error: err?.message || 'Failed to sync authentication session'
      });
    }
  };

  app.post(['/api/public/v1/auth/sync', '/api/auth/sync', '/auth/sync'], handleAuthSync);

  // ==========================================================================
  // 7. API KEY GENERATION & REMOTE ACCESS MANAGEMENT ENDPOINTS
  // ==========================================================================

  app.get(['/api/public/v1/keys/list', '/api/keys/list'], (req, res) => {
    const keys = Array.from(serverApiKeysStore.values());
    res.json({
      ok: true,
      count: keys.length,
      keys: keys.map(k => ({
        id: k.id,
        name: k.name,
        apiKey: k.apiKey,
        prefix: k.prefix,
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt,
        status: k.status,
        rateLimitPerMin: k.rateLimitPerMin,
        permissions: k.permissions,
        usageCount: k.usageCount || 0
      }))
    });
  });

  app.post(['/api/public/v1/keys/generate', '/api/keys/generate'], (req, res) => {
    try {
      const { name, permissions, rate_limit } = req.body || {};
      const timestamp = Date.now().toString(36);
      const rand1 = Math.random().toString(36).substring(2, 10);
      const rand2 = Math.random().toString(36).substring(2, 10);
      const newApiKey = `vx_live_${timestamp}_${rand1}${rand2}`;

      const keyRecord = {
        id: `key_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: (name && typeof name === 'string' && name.trim()) || 'Production Website API Key',
        apiKey: newApiKey,
        prefix: newApiKey.substring(0, 15) + '...',
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
        status: 'active',
        rateLimitPerMin: Number(rate_limit) || 120,
        permissions: Array.isArray(permissions) ? permissions : ['videos:create', 'scripts:generate', 'audio:tts', 'assets:search', 'remote:embed'],
        usageCount: 0
      };

      serverApiKeysStore.set(newApiKey, keyRecord);

      return res.json({
        ok: true,
        message: 'API Key generated successfully',
        key: keyRecord
      });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err?.message || 'Failed to generate API Key' });
    }
  });

  app.post(['/api/public/v1/keys/revoke', '/api/keys/revoke'], (req, res) => {
    const { apiKey, id } = req.body || {};
    let found = false;

    for (const [k, record] of serverApiKeysStore.entries()) {
      if (record.id === id || record.apiKey === apiKey) {
        record.status = 'revoked';
        found = true;
      }
    }

    if (found) {
      res.json({ ok: true, message: 'API key revoked successfully' });
    } else {
      res.status(404).json({ ok: false, error: 'API key not found' });
    }
  });

  app.get(['/api/public/v1/keys/verify', '/api/keys/verify'], (req, res) => {
    const customApiKey = (req.headers['x-api-key'] || req.headers['apikey'] || req.query['api_key'] || req.query['apiKey'] || '') as string;
    if (customApiKey && serverApiKeysStore.has(customApiKey)) {
      const record = serverApiKeysStore.get(customApiKey);
      if (record.status === 'active') {
        return res.json({ ok: true, valid: true, key: record });
      }
      return res.status(403).json({ ok: false, valid: false, error: 'API key is revoked' });
    }
    // Also allow fallback public key for remote widgets
    return res.json({
      ok: true,
      valid: true,
      mode: 'public_permissive',
      message: 'Zero-friction access enabled for remote widgets and embedded creators.'
    });
  });

  // ==========================================================================
  // 8. UNIVERSAL EMBED JAVASCRIPT SDK (FOR ZERO-LOGIN REMOTE WEBSITES)
  // ==========================================================================

  app.get('/embed.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    const embedJsCode = `
/**
 * Vixora AI Studio Remote Embed SDK
 * Enables 1-click zero-login embedded Video Creator and AI Assistant widgets on any website.
 */
(function() {
  const SCRIPT_URL = document.currentScript ? document.currentScript.src : window.location.origin + '/embed.js';
  const BASE_URL = new URL(SCRIPT_URL).origin;

  function initVixoraEmbeds() {
    // 1. Mount Video Creator Containers
    const videoTargets = document.querySelectorAll('#vixora-video-creator, [data-vixora-creator], vixora-video-creator');
    videoTargets.forEach(target => {
      if (target.dataset.vixoraMounted) return;
      target.dataset.vixoraMounted = 'true';

      const apiKey = target.dataset.apiKey || target.getAttribute('api-key') || 'vx_live_vixora_prod_89f3a928b7e411d9c02';
      const theme = target.dataset.theme || target.getAttribute('theme') || 'dark';
      const height = target.dataset.height || target.getAttribute('height') || '740px';

      const iframe = document.createElement('iframe');
      iframe.src = BASE_URL + '/?embed=creator&apiKey=' + encodeURIComponent(apiKey) + '&theme=' + encodeURIComponent(theme);
      iframe.style.width = '100%';
      iframe.style.height = height;
      iframe.style.border = 'none';
      iframe.style.borderRadius = '24px';
      iframe.style.boxShadow = '0 20px 40px -15px rgba(0,0,0,0.5)';
      iframe.allow = 'camera; microphone; display-capture; clipboard-write;';
      target.appendChild(iframe);
    });

    // 2. Mount AI Assistant / Chat Containers
    const chatTargets = document.querySelectorAll('#vixora-ai-assistant, [data-vixora-assistant], vixora-ai-assistant');
    chatTargets.forEach(target => {
      if (target.dataset.vixoraMounted) return;
      target.dataset.vixoraMounted = 'true';

      const apiKey = target.dataset.apiKey || target.getAttribute('api-key') || 'vx_live_vixora_prod_89f3a928b7e411d9c02';
      const theme = target.dataset.theme || target.getAttribute('theme') || 'dark';
      const height = target.dataset.height || target.getAttribute('height') || '640px';

      const iframe = document.createElement('iframe');
      iframe.src = BASE_URL + '/?embed=chat&apiKey=' + encodeURIComponent(apiKey) + '&theme=' + encodeURIComponent(theme);
      iframe.style.width = '100%';
      iframe.style.height = height;
      iframe.style.border = 'none';
      iframe.style.borderRadius = '24px';
      iframe.style.boxShadow = '0 20px 40px -15px rgba(0,0,0,0.5)';
      iframe.allow = 'camera; microphone; display-capture; clipboard-write;';
      target.appendChild(iframe);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVixoraEmbeds);
  } else {
    initVixoraEmbeds();
  }

  window.VixoraEmbed = {
    mount: initVixoraEmbeds,
    baseUrl: BASE_URL
  };
})();
`;
    res.send(embedJsCode);
  });

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
