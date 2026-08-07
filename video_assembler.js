#!/usr/bin/env node
/**
 * Naija Creator Hub - Javascript Video Assembly & FFmpeg pipeline
 * =============================================================
 * Handles video mapping, splits narrator segments, outputs timed .ass captions,
 * and streams compilation into a single MP4 file utilizing FFmpeg commands.
 * 
 * Requirements:
 *    npm install fluent-ffmpeg
 *    Assumes ffmpeg is installed on system paths.
 * 
 * Usage:
 *    node video_assembler.js --script "Script data..." --audio voiceover.wav --videos video1.mp4 video2.mp4 --output final.mp4 --orientation vertical
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import https from 'https';

// Mood of the script mapping lists
const extractMoodFromScript = (text) => {
  const content = text.toLowerCase();
  if (content.includes('calm') || content.includes('peace') || content.includes('relax') || content.includes('nature') || content.includes('breathe') || content.includes('soothing')) {
    return 'calm';
  }
  if (content.includes('upbeat') || content.includes('happy') || content.includes('joy') || content.includes('fun') || content.includes('exciting') || content.includes('bright')) {
    return 'upbeat';
  }
  if (content.includes('dramatic') || content.includes('epic') || content.includes('scary') || content.includes('danger') || content.includes('sad') || content.includes('dark')) {
    return 'dramatic';
  }
  if (content.includes('tech') || content.includes('future') || content.includes('cyber') || content.includes('space') || content.includes('cyberpunk')) {
    return 'tech';
  }
  if (content.includes('corporate') || content.includes('business') || content.includes('professional') || content.includes('office') || content.includes('presentation')) {
    return 'corporate';
  }
  return 'motivational';
};

const BGM_TRACKS = {
  motivational: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  dramatic: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  calm: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  upbeat: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
  corporate: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
  tech: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3'
};

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        // Handle redirect
        https.get(response.headers.location, (redirResponse) => {
          redirResponse.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve(dest);
          });
        }).on('error', (err) => {
          try { fs.unlinkSync(dest); } catch(e){}
          reject(err);
        });
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(dest);
      });
    }).on('error', (err) => {
      try { fs.unlinkSync(dest); } catch(e){}
      reject(err);
    });
  });
};

// Simple arguments parser
const args = {};
process.argv.slice(2).forEach((arg, index, arr) => {
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    const value = arr[index + 1];
    if (value && !value.startsWith('--')) {
      if (key === 'videos') {
        args[key] = [];
        let i = index + 1;
        while (arr[i] && !arr[i].startsWith('--')) {
          args[key].push(arr[i]);
          i++;
        }
      } else {
        args[key] = value;
      }
    }
  }
});

const script = args.script || '';
const audioPath = args.audio || '';
const videoPaths = args.videos || [];
const orientation = args.orientation || 'vertical';
const outputPath = args.output || 'compiled_output.mp4';
const highlightColor = args.highlight_color || '00FFFF'; // ASS style: BGR hex (Yellow custom is 00FFFF)

if (!script || !audioPath || videoPaths.length === 0) {
  console.log('[!] Usage: node video_assembler.js --script "your script..." --audio voiceover.wav --videos clip1.mp4 clip2.mp4 --output final.mp4');
  console.log('[!] Ensure to add appropriate arguments.');
  process.exit(1);
}

// 1. Get Audio duration using ffprobe
const getMediaDuration = (filePath) => {
  return new Promise((resolve, reject) => {
    exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`, (err, stdout) => {
      if (err) return reject(err);
      resolve(parseFloat(stdout.trim()));
    });
  });
};

const assemble = async () => {
  try {
    console.log('[+] Starting Javascript FFmpeg video editor...');
    const audioDuration = await getMediaDuration(audioPath);
    console.log(`[+] Input audio duration details calculated: ${audioDuration} seconds`);

    // Split sentences
    const sentences = script
      .split(/(?<=[.!?])\s+|\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 3);

    if (sentences.length === 0) {
      console.log('[-] Invalid script content.');
      process.exit(1);
    }

    const totalChars = sentences.reduce((sum, s) => sum + s.length, 0);

    // Build timeline mapping
    let elapsed = 0;
    const timeline = sentences.map((sentence, idx) => {
      const weight = sentence.length / totalChars;
      const duration = weight * audioDuration;
      const start = elapsed;
      const end = elapsed + duration;
      elapsed = end;

      // Group words
      const words = sentence.split(/\s+/);
      const totalWordChars = words.reduce((acc, w) => acc + w.length, 0);
      let wordElapsed = start;
      
      const timedWords = words.map((w) => {
        const wordWeight = w.length / totalWordChars;
        const wDur = wordWeight * duration;
        const wStart = wordElapsed;
        const wEnd = wordElapsed + wDur;
        wordElapsed = wEnd;
        return { text: w, start: wStart, end: wEnd };
      });

      return {
        id: idx,
        text: sentence,
        start,
        end,
        words: timedWords
      };
    });

    // Write premium Advanced SubStation Alpha (.ass) style subtitle cue entries
    // This allows custom styles: fonts, sizes, strokes, margins and word-by-word karaoke highlights!
    const assFile = path.resolve('./temp_subtitles.ass');
    const assHeader = `[Script Info]
Title: Creator Hub Auto Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: CapCut,Space Grotesk,50,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,5,1,2,50,50,300,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    let assBody = '';
    const formatAssTime = (sec) => {
      const hrs = Math.floor(sec / 3600);
      const mins = Math.floor((sec % 3600) / 60);
      const secs = Math.floor(sec % 60);
      const ms = Math.floor((sec % 1) * 100);
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    // Generating timing dialogues word-by-word highlights
    timeline.forEach(segment => {
      segment.words.forEach(wordObj => {
        const startStr = formatAssTime(wordObj.start);
        const endStr = formatAssTime(wordObj.end);
        
        // Wrap other words of sentence as standard white, only active word colored
        const styledSentence = segment.words.map(w => {
          if (w === wordObj) {
            return `{\\1c&H${highlightColor}&}${w.text}{\\1c&HFFFFFF&}`;
          }
          return w.text;
        }).join(' ');

        assBody += `Dialogue: 0,${startStr},${endStr},CapCut,,0,0,0,,${styledSentence}\n`;
      });
    });

    fs.writeFileSync(assFile, assHeader + assBody);
    console.log('[+] Advanced timed sub-captions file written successfully.');

    // Auto-detect script mood theme & download background track loop safely
    const detectedMood = extractMoodFromScript(script);
    const bgmUrl = BGM_TRACKS[detectedMood] || BGM_TRACKS.motivational;
    const bgmTempPath = path.join(path.dirname(outputPath) || '.', 'temp_bgm.mp3');

    console.log(`[+] Auto-detected script mood theme: ${detectedMood.toUpperCase()}`);
    console.log(`[+] Sourcing background music loops from: ${bgmUrl}`);
    
    try {
      await downloadFile(bgmUrl, bgmTempPath);
      console.log(`[+] Background loop track prepared and cached successfully.`);
    } catch (bgmErr) {
      console.error(`[-] Could not download BGM track loop, running voiceover compile fallback:`, bgmErr);
    }

    const hasBgm = fs.existsSync(bgmTempPath);

    // 2. Generate FFmpeg command scripts
    const w = orientation === 'vertical' ? 1080 : 1920;
    const h = orientation === 'vertical' ? 1920 : 1080;

    // Concatenate video filters dynamically in a single pipeline
    // For each segment index, feed the matching sourced clip scaled, cropped to target orientation box
    console.log('[+] Preparing ffmpeg command chains matching timeline mapping window...');
    let filterComplex = '';
    let inputs = '';

    videoPaths.forEach((vPath, idx) => {
      inputs += ` -i "${vPath}"`;
    });
    // Add voiceover audio input
    inputs += ` -i "${audioPath}"`;
    
    if (hasBgm) {
      // Add background music loop input
      inputs += ` -stream_loop -1 -i "${bgmTempPath}"`;
    }

    // Map each segment slot in timeline in order
    let sceneInputsCount = videoPaths.length;
    let bmgInputIdx = sceneInputsCount + 1; // index in FFmpeg inputs array
    let mapStrs = '';

    timeline.forEach((seg, index) => {
      const clipIdx = index % sceneInputsCount;
      const duration = seg.end - seg.start;
      
      // Scale and Crop to vertical or landscape
      filterComplex += `[${clipIdx}:v]scale=w=${w}:h=${h}:force_original_aspect_ratio=increase,crop=${w}:${h},trim=duration=${duration},setpts=PTS-STARTPTS[v${index}];`;
      mapStrs += `[v${index}]`;
    });

    filterComplex += `${mapStrs}concat=n=${timeline.length}:v=1:a=0[vmaster];`;
    
    if (hasBgm) {
      // Attach Subtitles track filter
      filterComplex += `[vmaster]subtitles='${assFile.replace(/\\/g, '/')}'[vfinal];`;
      // Audio Mixer Graph
      filterComplex += `[${sceneInputsCount}:a]volume=1.0[vo];[${bmgInputIdx}:a]volume=0.15[bg];[vo][bg]amix=inputs=2:duration=first:dropout_transition=2[mixed_audio]`;
    } else {
      filterComplex += `[vmaster]subtitles='${assFile.replace(/\\/g, '/')}'[vfinal]`;
    }

    const finalCmd = hasBgm
      ? `ffmpeg -y ${inputs} -filter_complex "${filterComplex}" -map "[vfinal]" -map "[mixed_audio]" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 192k "${outputPath}"`
      : `ffmpeg -y ${inputs} -filter_complex "${filterComplex}" -map "[vfinal]" -map ${sceneInputsCount}:a -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 192k "${outputPath}"`;

    console.log('[+] Run command pipeline generated:');
    console.log(`    ${finalCmd.slice(0, 500)}...`);

    console.log('[+] Compiling final media clips using FFmpeg wrapper. Please wait...');
    
    exec(finalCmd, (execErr, stdout, stderr) => {
      // Clean temporary timing subtitles and temporary download tracks
      try { fs.unlinkSync(assFile); } catch(e){}
      try { if (hasBgm) fs.unlinkSync(bgmTempPath); } catch(e){}

      if (execErr) {
        console.error('[-] Compilation error: ', execErr);
        console.log('[-] Ensure ffmpeg is installed and subtitle directories/configuration parameters are correct.');
        process.exit(1);
      }
      console.log(`[+] SUCCESS! Final production movie exported successfully: ${outputPath}`);
    });

  } catch (error) {
    console.error('[-] Error executing Javascript assembly pipeline: ', error);
  }
};

assemble();
