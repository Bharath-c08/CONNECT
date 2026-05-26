'use client';

let audioCtx: AudioContext | null = null;
let ringInterval: NodeJS.Timeout | null = null;

let initialized = false;

const initAudio = () => {
  if (typeof window === 'undefined') return;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  initialized = true;
};

// Warm up the audio context on the very first user interaction
if (typeof window !== 'undefined') {
  const setupAudio = () => {
    initAudio();
    window.removeEventListener('click', setupAudio);
    window.removeEventListener('keydown', setupAudio);
    window.removeEventListener('touchstart', setupAudio);
  };
  window.addEventListener('click', setupAudio);
  window.addEventListener('keydown', setupAudio);
  window.addEventListener('touchstart', setupAudio);
}

export const playNotificationSound = () => {
  try {
    initAudio();
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1); // up to A6

    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } catch (e) {
    console.error('Audio play error:', e);
  }
};

export const startRinging = () => {
  if (ringInterval) return;
  
  const playRing = () => {
    try {
      initAudio();
      if (!audioCtx) return;

      // Create a classic double ring sound
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      osc.frequency.setValueAtTime(480, audioCtx.currentTime + 0.1); // warble
      
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      // Ring 1
      gainNode.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 0.05);
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime + 0.4);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.45);
      
      // Ring 2
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime + 0.55);
      gainNode.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 0.6);
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime + 1.0);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.05);

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 1.2);
    } catch(e) {
      console.error('Ringing error:', e);
    }
  };
  
  playRing();
  ringInterval = setInterval(playRing, 3500); // repeat every 3.5 seconds
};

export const stopRinging = () => {
  if (ringInterval) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
};
