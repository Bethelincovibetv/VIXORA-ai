// Stock Clip Sourcing & Semantic Match Verification Engine

export interface VisualClipCandidate {
  id: number | string;
  url: string;
  image: string;
  duration: number;
  mediaType: 'video' | 'photo';
  title: string;
  alt?: string;
  video_files: Array<{
    link: string;
    quality: string;
    width: number;
    height: number;
  }>;
  matchScore: number; // 0.0 to 1.0
  searchQuery: string;
  confidence: 'high' | 'medium' | 'low_confidence';
  fallbackUsed: boolean;
  beatText?: string;
  beatIndex?: number;
}

export interface BeatAuditLog {
  beatIndex: number;
  beatText: string;
  searchQuery: string;
  chosenId: number | string;
  chosenTitle: string;
  mediaType: 'video' | 'photo';
  matchScore: number; // Percentage 0-100
  confidence: 'high' | 'medium' | 'low_confidence';
  fallbackUsed: boolean;
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'this', 'that', 'these', 'those', 'it', 'its', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'not', 'no', 'if', 'when', 'where', 'why', 'how', 'what', 'who', 'which', 'you', 'your', 'we', 'our', 'my', 'me', 'he', 'she', 'they', 'them', 'make', 'made', 'get', 'got', 'like', 'just', 'more'
]);

export const extractKeywords = (text: string): string[] => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
};

export async function scoreAndFetchBeatVisual(
  beatText: string,
  searchQuery: string,
  orientation: 'portrait' | 'landscape' | 'square',
  pexelsApiKey: string,
  usedIds: Set<number | string>,
  beatIndex: number = 0
): Promise<{ clip: VisualClipCandidate; audit: BeatAuditLog }> {
  const beatKeywords = extractKeywords(`${beatText} ${searchQuery}`);

  // Attempt 1: Fetch Video Candidates from Pexels Video API
  let videoCandidates: any[] = [];
  try {
    const res = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(searchQuery)}&per_page=8&orientation=${orientation}`, {
      headers: { Authorization: pexelsApiKey }
    });
    if (res.ok) {
      const data = await res.json();
      videoCandidates = data.videos || [];
    }
  } catch (err) {
    console.warn(`[!] Video query failed for beat "${searchQuery}":`, err);
  }

  // Score Video Candidates
  const scoredVideos: VisualClipCandidate[] = videoCandidates.map((v: any) => {
    const pexelsSlug = (v.url || '').toLowerCase();
    const userName = (v.user?.name || '').toLowerCase();
    const fullMeta = `${pexelsSlug} ${userName}`;

    let matches = 0;
    beatKeywords.forEach(kw => {
      if (fullMeta.includes(kw)) matches++;
    });

    const baseScore = beatKeywords.length > 0 ? (matches / beatKeywords.length) : 0.5;

    // Quality bonus
    const hasHD = (v.video_files || []).some((f: any) => f.quality === 'hd' || f.width >= 1280);
    const hdBonus = hasHD ? 0.15 : 0.05;

    // Duration suitability bonus (videos at least 3s long)
    const durBonus = (v.duration || 0) >= 3 ? 0.10 : 0.0;

    // Repeat penalty
    const isUsed = usedIds.has(v.id);
    const repeatPenalty = isUsed ? 0.50 : 0.0;

    const rawScore = (baseScore * 0.70) + hdBonus + durBonus - repeatPenalty;
    const matchScore = Math.min(1.0, Math.max(0.0, rawScore));

    const hdFile = (v.video_files || []).find((f: any) => f.quality === 'hd') || (v.video_files || [])[0];

    const slugTitle = pexelsSlug.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || `Pexels HD Video ${v.id}`;

    return {
      id: v.id,
      url: v.url || '',
      image: v.image || hdFile?.link || '',
      duration: v.duration || 8,
      mediaType: 'video',
      title: slugTitle,
      video_files: v.video_files || [],
      matchScore,
      searchQuery,
      confidence: matchScore >= 0.65 ? 'high' : matchScore >= 0.35 ? 'medium' : 'low_confidence',
      fallbackUsed: false,
      beatText,
      beatIndex
    };
  });

  scoredVideos.sort((a, b) => b.matchScore - a.matchScore);

  // Check if top video candidate meets relevance threshold (score >= 0.35)
  if (scoredVideos.length > 0 && scoredVideos[0].matchScore >= 0.35) {
    const chosen = scoredVideos[0];
    usedIds.add(chosen.id);

    console.log(`[+] Beat ${beatIndex + 1} Matched HD Video ID #${chosen.id} (Score: ${(chosen.matchScore * 100).toFixed(0)}%) for query: "${searchQuery}"`);

    return {
      clip: chosen,
      audit: {
        beatIndex,
        beatText,
        searchQuery,
        chosenId: chosen.id,
        chosenTitle: chosen.title,
        mediaType: 'video',
        matchScore: Math.round(chosen.matchScore * 100),
        confidence: chosen.confidence,
        fallbackUsed: false
      }
    };
  }

  // Attempt 2: Fall back to Pexels Photo API with Ken Burns Motion
  console.info(`[i] Beat ${beatIndex + 1}: Video score below threshold (${scoredVideos[0]?.matchScore || 0}). Sourcing Pexels Photo for Ken Burns Motion...`);
  
  let photoCandidates: any[] = [];
  try {
    const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=8&orientation=${orientation}`, {
      headers: { Authorization: pexelsApiKey }
    });
    if (res.ok) {
      const data = await res.json();
      photoCandidates = data.photos || [];
    }
  } catch (err) {
    console.warn(`[!] Photo query failed for beat "${searchQuery}":`, err);
  }

  const scoredPhotos: VisualClipCandidate[] = photoCandidates.map((p: any) => {
    const altText = (p.alt || p.url || '').toLowerCase();
    let matches = 0;
    beatKeywords.forEach(kw => {
      if (altText.includes(kw)) matches++;
    });

    const baseScore = beatKeywords.length > 0 ? (matches / beatKeywords.length) : 0.4;
    const isUsed = usedIds.has(`photo_${p.id}`);
    const repeatPenalty = isUsed ? 0.40 : 0.0;

    const rawScore = (baseScore * 0.70) + 0.20 - repeatPenalty;
    const matchScore = Math.min(1.0, Math.max(0.0, rawScore));

    const photoUrl = p.src?.large2x || p.src?.large || p.src?.medium || p.url || '';

    return {
      id: `photo_${p.id}`,
      url: p.url || photoUrl,
      image: photoUrl,
      duration: 8,
      mediaType: 'photo',
      title: p.alt || `Cinematic Photo ${p.id}`,
      alt: p.alt || '',
      video_files: [{ link: photoUrl, quality: 'hd', width: p.width || 1080, height: p.height || 1920 }],
      matchScore,
      searchQuery,
      confidence: matchScore >= 0.55 ? 'medium' : 'low_confidence',
      fallbackUsed: true,
      beatText,
      beatIndex
    };
  });

  scoredPhotos.sort((a, b) => b.matchScore - a.matchScore);

  if (scoredPhotos.length > 0 && scoredPhotos[0].matchScore >= 0.25) {
    const chosen = scoredPhotos[0];
    usedIds.add(chosen.id);

    console.log(`[+] Beat ${beatIndex + 1} Matched Ken Burns Photo ID #${chosen.id} (Score: ${(chosen.matchScore * 100).toFixed(0)}%) for query: "${searchQuery}"`);

    return {
      clip: chosen,
      audit: {
        beatIndex,
        beatText,
        searchQuery,
        chosenId: chosen.id,
        chosenTitle: chosen.title,
        mediaType: 'photo',
        matchScore: Math.round(chosen.matchScore * 100),
        confidence: chosen.confidence,
        fallbackUsed: true
      }
    };
  }

  // Attempt 3: Visually Neutral Thematic Fallback Clip
  console.warn(`[!] Beat ${beatIndex + 1}: Sourcing neutral thematic fallback clip for "${searchQuery}"...`);
  const neutralQuery = searchQuery.split(' ')[0] || "modern studio background";
  
  let fallbackClip: VisualClipCandidate = {
    id: `fallback_${beatIndex}_${Date.now()}`,
    url: "https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-background-1611-large.mp4",
    image: "https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1",
    duration: 8,
    mediaType: 'photo',
    title: `Thematic Visual (${neutralQuery})`,
    video_files: [{ link: "https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-background-1611-large.mp4", quality: 'hd', width: 1080, height: 1920 }],
    matchScore: 0.20,
    searchQuery,
    confidence: 'low_confidence',
    fallbackUsed: true,
    beatText,
    beatIndex
  };

  try {
    const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(neutralQuery)}&per_page=3&orientation=${orientation}`, {
      headers: { Authorization: pexelsApiKey }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.photos && data.photos.length > 0) {
        const p = data.photos[0];
        const pUrl = p.src?.large2x || p.src?.large || '';
        fallbackClip = {
          id: `fallback_photo_${p.id}`,
          url: pUrl,
          image: pUrl,
          duration: 8,
          mediaType: 'photo',
          title: p.alt || `Neutral Visual (${neutralQuery})`,
          video_files: [{ link: pUrl, quality: 'hd', width: p.width || 1080, height: p.height || 1920 }],
          matchScore: 0.30,
          searchQuery,
          confidence: 'low_confidence',
          fallbackUsed: true,
          beatText,
          beatIndex
        };
      }
    }
  } catch (e) {
    // Keep default neutral fallback
  }

  usedIds.add(fallbackClip.id);

  return {
    clip: fallbackClip,
    audit: {
      beatIndex,
      beatText,
      searchQuery,
      chosenId: fallbackClip.id,
      chosenTitle: fallbackClip.title,
      mediaType: fallbackClip.mediaType,
      matchScore: Math.round(fallbackClip.matchScore * 100),
      confidence: 'low_confidence',
      fallbackUsed: true
    }
  };
}
