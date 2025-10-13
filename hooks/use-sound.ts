"use client";

import { useCallback, useRef, useEffect } from "react";

/**
 * Create sound effects using Web Audio API
 */
class SoundGenerator {
  private audioContext: AudioContext | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  // ULTIMATE dopamine hit - satisfying purchase sound
  playSuccess() {
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Bass drop for impact
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bass.connect(bassGain);
    bassGain.connect(ctx.destination);
    bass.frequency.setValueAtTime(80, now);
    bass.frequency.exponentialRampToValueAtTime(40, now + 0.3);
    bass.type = "sine";
    bassGain.gain.setValueAtTime(0.4, now);
    bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    bass.start(now);
    bass.stop(now + 0.3);

    // Ascending triumph melody
    const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      const startTime = now + 0.1 + (i * 0.08);
      osc.frequency.setValueAtTime(freq, startTime);
      osc.type = "sine";

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.35, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);

      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });

    // Sparkle effect on top
    [1200, 1600, 2000].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      const startTime = now + 0.25 + (i * 0.05);
      osc.frequency.setValueAtTime(freq, startTime);
      osc.type = "triangle";

      gainNode.gain.setValueAtTime(0.15, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

      osc.start(startTime);
      osc.stop(startTime + 0.2);
    });
  }

  // Cash register sound
  playCashRegister() {
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Bell sound
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.frequency.setValueAtTime(1200, now);
    osc1.type = "sine";
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc1.start(now);
    osc1.stop(now + 0.3);

    // Cash drawer sound (lower frequency)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.frequency.setValueAtTime(150, now + 0.15);
    osc2.type = "square";
    gain2.gain.setValueAtTime(0.2, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    osc2.start(now + 0.15);
    osc2.stop(now + 0.4);
  }

  // Coin drop sound
  playCoinDrop() {
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Metallic ping
    osc.frequency.setValueAtTime(1000, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
    osc.type = "triangle";

    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Jackpot sound for big purchases
  playJackpot() {
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Ascending cascade of tones
    const frequencies = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
    
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      const startTime = now + (i * 0.08);
      osc.frequency.setValueAtTime(freq, startTime);
      osc.type = "sine";

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.25, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });
  }
}

let soundGenerator: SoundGenerator | null = null;

export function useSound() {
  const isEnabledRef = useRef(true);

  useEffect(() => {
    if (typeof window !== "undefined" && !soundGenerator) {
      soundGenerator = new SoundGenerator();
    }
  }, []);

  const playSuccess = useCallback(() => {
    if (isEnabledRef.current && soundGenerator) {
      soundGenerator.playSuccess();
    }
  }, []);

  const playCashRegister = useCallback(() => {
    if (isEnabledRef.current && soundGenerator) {
      soundGenerator.playCashRegister();
    }
  }, []);

  const playCoinDrop = useCallback(() => {
    if (isEnabledRef.current && soundGenerator) {
      soundGenerator.playCoinDrop();
    }
  }, []);

  const playJackpot = useCallback(() => {
    if (isEnabledRef.current && soundGenerator) {
      soundGenerator.playJackpot();
    }
  }, []);

  const toggleSound = useCallback(() => {
    isEnabledRef.current = !isEnabledRef.current;
    return isEnabledRef.current;
  }, []);

  return {
    playSuccess,
    playCashRegister,
    playCoinDrop,
    playJackpot,
    toggleSound,
    isEnabled: isEnabledRef.current,
  };
}

