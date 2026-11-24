'use client';

import { useEffect, useRef } from 'react';
import { TILT } from '../constants';

type Options = {
  active: boolean;
  onTilt: (value: number) => void; // 0..1, вызывается часто — не пишите сюда setState
  onTrigger: () => void;           // наклон удержан, можно пить
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const isLandscape = () => {
  const angle = Math.abs(window.screen?.orientation?.angle ?? 0);
  return angle === 90 || angle === 270;
};

/**
 * Колбэки лежат в ref, поэтому смена consume/onTilt не перезапускает подписку
 * и не сбрасывает таймер удержания.
 */
export function useTiltSensor({ active, onTilt, onTrigger }: Options) {
  const onTiltRef = useRef(onTilt);
  const onTriggerRef = useRef(onTrigger);
  useEffect(() => { onTiltRef.current = onTilt; onTriggerRef.current = onTrigger; });

  useEffect(() => {
    if (!active) return;

    let current = 0;
    let fired = false;
    let hold: ReturnType<typeof setTimeout> | null = null;
    let lastOrientationAt = 0;
    let lastUpdateAt = performance.now();
    let baselineAngle: number | null = null;
    let baselineGravity: number | null = null;
    let angleSamples = 0;
    let gravitySamples = 0;
    let landscape = isLandscape();
    onTiltRef.current(0);

    const resetCalibration = () => {
      baselineAngle = null; baselineGravity = null;
      angleSamples = 0; gravitySamples = 0; current = 0;
    };
    const syncScreenMode = () => {
      const now = isLandscape();
      if (now !== landscape) { landscape = now; resetCalibration(); }
    };

    const push = (target: number) => {
      if (fired) return;
      const now = performance.now();
      const elapsed = Math.min(TILT.maxFrameMs, Math.max(TILT.minFrameMs, now - lastUpdateAt));
      lastUpdateAt = now;
      let next = current + (target - current) * (1 - Math.pow(TILT.smoothing, elapsed / 16.67));
      if (next < TILT.deadZone) next = 0;
      current = next;
      onTiltRef.current(next);

      if (next > TILT.triggerAt && !hold) {
        hold = setTimeout(() => { hold = null; fired = true; onTriggerRef.current(); }, TILT.holdMs);
      }
      if (next <= TILT.releaseAt && hold) { clearTimeout(hold); hold = null; }
    };

    const onOrientation = (event: DeviceOrientationEvent) => {
      syncScreenMode();
      // В портрете ребро — это gamma, в ландшафте оси меняются местами.
      // Ландшафтная ветка требует проверки на устройстве.
      const value = landscape ? event.beta : event.gamma;
      if (value == null) return;
      lastOrientationAt = performance.now();
      if (angleSamples < TILT.calibrationSamples || baselineAngle == null) {
        baselineAngle = baselineAngle == null ? value : baselineAngle + (value - baselineAngle) / (angleSamples + 1);
        angleSamples += 1;
        push(0);
        return;
      }
      const degrees = Math.abs(value - baselineAngle);
      push(clamp01((degrees - TILT.minDegrees) / (TILT.maxDegrees - TILT.minDegrees)));
    };

    const onMotion = (event: DeviceMotionEvent) => {
      syncScreenMode();
      const gravity = event.accelerationIncludingGravity;
      if (!gravity || gravity.x == null || gravity.y == null || gravity.z == null) return;
      const axis = landscape ? gravity.y : gravity.x;
      if (gravitySamples < TILT.calibrationSamples || baselineGravity == null) {
        baselineGravity = baselineGravity == null ? axis : baselineGravity + (axis - baselineGravity) / (gravitySamples + 1);
        gravitySamples += 1;
        return;
      }
      // DeviceOrientation стабильнее; акселерометр — только запасной вариант.
      if (performance.now() - lastOrientationAt < TILT.motionFallbackAfterMs) return;
      const delta = Math.abs(axis - baselineGravity);
      push(clamp01((delta - TILT.gravityMin) / (TILT.gravityMax - TILT.gravityMin)));
    };

    window.addEventListener('deviceorientation', onOrientation, { passive: true });
    window.addEventListener('devicemotion', onMotion, { passive: true });
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      window.removeEventListener('devicemotion', onMotion);
      if (hold) clearTimeout(hold);
    };
  }, [active]);
}
