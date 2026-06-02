const HORROR_AUDIO = {
  refreshWarning: encodeURI('/亲爱的，你以为刷新就能逃脱吗？.mp3'),
  refreshTrap: encodeURI('/不会让你逃掉的，亲爱的.mp3'),
  perfunctory: encodeURI('/你连看都不看一眼，是在敷衍我吗？.mp3'),
};

const activeHorrorAudios = new Set();
const primedHorrorAudios = new Map();

function getHorrorAudio(src) {
  if (!primedHorrorAudios.has(src)) {
    const audio = new Audio(src);
    audio.preload = 'auto';
    primedHorrorAudios.set(src, audio);
  }
  return primedHorrorAudios.get(src);
}

function clonePrimedHorrorAudio(src) {
  const primed = getHorrorAudio(src);
  const audio = new Audio(src);
  audio.preload = 'auto';
  audio.volume = primed.volume;
  return audio;
}

export function primeHorrorAudio() {
  Object.values(HORROR_AUDIO).forEach((src) => {
    getHorrorAudio(src).load();
  });

  try {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (AudioContextCtor) {
      const ctx = new AudioContextCtor();
      ctx.resume().finally(() => {
        window.setTimeout(() => ctx.close(), 250);
      });
    }
  } catch (error) {
    console.warn('[HorrorAudio] audio context prime skipped:', error);
  }

  localStorage.setItem('horror_audio_primed', 'true');
}

export function playHorrorAudio(src) {
  if (!src) return Promise.resolve(false);

  const audio = clonePrimedHorrorAudio(src);
  activeHorrorAudios.add(audio);
  audio.addEventListener('ended', () => activeHorrorAudios.delete(audio), { once: true });
  audio.addEventListener('error', () => {
    activeHorrorAudios.delete(audio);
    console.warn('[HorrorAudio] failed to load:', src, audio.error);
  }, { once: true });

  return audio.play()
    .then(() => true)
    .catch((error) => {
      activeHorrorAudios.delete(audio);
      console.warn('[HorrorAudio] playback skipped:', error);
      return false;
    });
}

export function getHorrorAudioSrc(type) {
  if (type === 'typewriter') return HORROR_AUDIO.refreshWarning;
  if (type === 'shatter') return HORROR_AUDIO.refreshTrap;
  if (type === 'perfunctory') return HORROR_AUDIO.perfunctory;
  return null;
}
