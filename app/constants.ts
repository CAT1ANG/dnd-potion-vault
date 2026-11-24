export const STORAGE_KEYS = {
  device: 'dnd-potion-device',
  sensors: 'dnd-potion-sensors',
} as const;

export const POLL_INTERVAL_MS = 2500;
export const TOAST_MS = 3200;
export const POUR_ANIMATION_MS = 1500;
export const DRAIN_START_DELAY_MS = 50;
export const MAX_PER_POTION = 24;
export const SCAN_INTERVAL_MS = 200;

// Жесты
export const SWIPE_VERTICAL_MIN_PX = 42;
export const SWIPE_HORIZONTAL_MIN_PX = 58;
export const SWIPE_HORIZONTAL_MAX_PX = 105;
export const SWIPE_HORIZONTAL_VIEWPORT_RATIO = 0.14;
export const DRAG_START_PX = 4;
export const DRAG_RUBBER_BAND = 0.24; // сопротивление за краем списка
export const DRAG_EASING = 0.34;
export const DRAG_SETTLE_PX = 0.3;

// Наклон телефона. По замерам на iPhone: вертикаль ≈ -5°, нужное ребро ≈ -88°;
// калибруемся относительно положения при открытии пробки.
export const TILT = {
  calibrationSamples: 12,
  minDegrees: 8,
  maxDegrees: 82,
  gravityMin: 1,
  gravityMax: 9.7,
  smoothing: 0.94, // коэффициент затухания на кадр ~16.67 мс
  deadZone: 0.025,
  triggerAt: 0.94,
  releaseAt: 0.8,
  holdMs: 200,
  motionFallbackAfterMs: 200, // акселерометр включается, если orientation замолчал
  minFrameMs: 8,
  maxFrameMs: 80,
} as const;
