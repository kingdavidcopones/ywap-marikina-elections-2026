'use client';

import {useEffect} from 'react';

const ANIMATION_DURATION_MS = 2500;
const BRAND_COLOR_TOKENS = [
  '--color-accent',
  '--color-text-accent',
  '--color-border-yellow',
  '--color-border-orange',
  '--color-border-cyan',
] as const;

export function BallotConfetti() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let isActive = true;
    let animationFrame = 0;
    let resetConfetti: (() => void) | undefined;

    void import('canvas-confetti').then(({default: confetti}) => {
      if (!isActive) return;
      const rootStyles = window.getComputedStyle(document.documentElement);
      const brandColors = BRAND_COLOR_TOKENS
        .map((token) => rootStyles.getPropertyValue(token).trim())
        .filter(Boolean);
      if (!brandColors.length) return;
      const animationEndsAt = Date.now() + ANIMATION_DURATION_MS;
      resetConfetti = () => confetti.reset();

      function launchConfetti() {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 70,
          startVelocity: 46,
          origin: {x: 0, y: 0.68},
          colors: brandColors,
          zIndex: 1000,
          disableForReducedMotion: true,
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 70,
          startVelocity: 46,
          origin: {x: 1, y: 0.68},
          colors: brandColors,
          zIndex: 1000,
          disableForReducedMotion: true,
        });

        if (Date.now() < animationEndsAt) {
          animationFrame = window.requestAnimationFrame(launchConfetti);
        }
      }

      launchConfetti();
    }).catch(() => {
      // The confirmation remains usable if the optional animation cannot load.
    });

    return () => {
      isActive = false;
      window.cancelAnimationFrame(animationFrame);
      resetConfetti?.();
    };
  }, []);

  return null;
}
