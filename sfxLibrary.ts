// Vixora Studio Sound Effect (SFX) Audio Engine & Library
// Supports both Web Audio API procedural synthesis (instant, zero-latency) and external SFX tracks

export interface SFXItem {
  id: string;
  name: string;
  category: 'transitions' | 'ui' | 'cinematic' | 'foley' | 'funny';
  icon: string;
  description: string;
  type: 'synth' | 'url';
  synthType?: string;
  url?: string;
}

export const PRESET_SFX_CATALOG: SFXItem[] = [
  {
    id: 'sfx_whoosh',
    name: 'Fast Air Whoosh',
    category: 'transitions',
    icon: 'fa-wind',
    description: 'Crisp air whip transition ideal for scene cuts and text popups.',
    type: 'synth',
    synthType: 'whoosh'
  },
  {
    id: 'sfx_pop',
    name: 'Bubble Pop',
    category: 'ui',
    icon: 'fa-circle-dot',
    description: 'Satisfying pop click for subtitle word reveals and emoji animations.',
    type: 'synth',
    synthType: 'pop'
  },
  {
    id: 'sfx_shutter',
    name: 'Camera Shutter Snap',
    category: 'foley',
    icon: 'fa-camera',
    description: 'Classic camera click snapshot effect for image reveals.',
    type: 'synth',
    synthType: 'shutter'
  },
  {
    id: 'sfx_cinematic_drop',
    name: 'Deep Sub Bass Impact',
    category: 'cinematic',
    icon: 'fa-burst',
    description: 'Heavy bass boom impact for dramatic hooks and power statements.',
    type: 'synth',
    synthType: 'sub_drop'
  },
  {
    id: 'sfx_sparkle',
    name: 'Magic Glint / Chime',
    category: 'ui',
    icon: 'fa-wand-magic-sparkles',
    description: 'High frequency sparkle chime for success, money, or key tips.',
    type: 'synth',
    synthType: 'sparkle'
  },
  {
    id: 'sfx_bell',
    name: 'Notification Ding',
    category: 'ui',
    icon: 'fa-bell',
    description: 'Clear crystal bell notification sound.',
    type: 'synth',
    synthType: 'bell'
  },
  {
    id: 'sfx_vinyl_scratch',
    name: 'Vinyl DJ Scratch',
    category: 'funny',
    icon: 'fa-record-vinyl',
    description: 'Fun vinyl record scratch for sudden plot twists or humor cuts.',
    type: 'synth',
    synthType: 'vinyl_scratch'
  },
  {
    id: 'sfx_applause',
    name: 'Crowd Cheer Burst',
    category: 'foley',
    icon: 'fa-hands-clapping',
    description: 'Upbeat crowd cheering noise burst.',
    type: 'synth',
    synthType: 'applause'
  },
  {
    id: 'sfx_error',
    name: 'Error Warning Buzz',
    category: 'ui',
    icon: 'fa-triangle-exclamation',
    description: 'Low warning buzz for mistakes or myths exposed.',
    type: 'synth',
    synthType: 'error_buzz'
  }
];

// Procedural Web Audio API Sound Synthesizer
let sharedAudioCtx: AudioContext | null = null;

export const getAudioContext = (): AudioContext => {
  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
};

export const playProceduralSFX = (synthType: string) => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    if (synthType === 'whoosh') {
      // Noise buffer + lowpass filter sweep
      const bufferSize = ctx.sampleRate * 0.25; // 250ms
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(200, now);
      filter.frequency.exponentialRampToValueAtTime(2200, now + 0.12);
      filter.frequency.exponentialRampToValueAtTime(300, now + 0.25);
      filter.Q.value = 3;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + 0.25);
    } else if (synthType === 'pop') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } else if (synthType === 'shutter') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } else if (synthType === 'sub_drop') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.6);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.6);
    } else if (synthType === 'sparkle') {
      [1200, 1600, 2100, 2800].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const delay = idx * 0.04;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + delay);

        gain.gain.setValueAtTime(0.15, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + delay);
        osc.stop(now + delay + 0.15);
      });
    } else if (synthType === 'bell') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, now); // C6 note

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    } else if (synthType === 'vinyl_scratch') {
      const bufferSize = ctx.sampleRate * 0.18;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin(i * 0.05);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      noise.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.18);
    } else if (synthType === 'applause') {
      const bufferSize = ctx.sampleRate * 0.5;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (i % 1000 < 200 ? 1 : 0.2);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      noise.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.5);
    } else if (synthType === 'error_buzz') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (err) {
    console.warn('SFX synthesis warning:', err);
  }
};
