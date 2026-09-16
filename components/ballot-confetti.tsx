'use client';

import {useEffect} from 'react';
import confetti from 'canvas-confetti';

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

    const rootStyles = window.getComputedStyle(document.documentElement);
    const brandColors = BRAND_COLOR_TOKENS
      .map((token) => rootStyles.getPropertyValue(token).trim())
      .filter(Boolean);
    if (!brandColors.length) return;
    const animationEndsAt = Date.now() + ANIMATION_DURATION_MS;
    let animationFrame = 0;

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

    return () => {
      window.cancelAnimationFrame(animationFrame);
      confetti.reset();
    };
  }, []);

  return null;
}
