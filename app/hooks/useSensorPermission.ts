'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { STORAGE_KEYS } from '../constants';
import { safeGet, safeSet } from '../lib/storage';

type Permission = 'granted' | 'denied';
type WithPermission = { requestPermission?: () => Promise<Permission> };

function targets() {
  return {
    orientation: window.DeviceOrientationEvent as unknown as WithPermission | undefined,
    motion: window.DeviceMotionEvent as unknown as WithPermission | undefined,
  };
}

/**
 * Оба requestPermission() создаются синхронно: после первого await Safari
 * уже может считать пользовательский жест завершённым.
 */
function requestSensorPermissions(): Promise<boolean> {
  const { orientation, motion } = targets();
  const requests: Array<Promise<Permission>> = [];
  if (typeof orientation?.requestPermission === 'function') requests.push(orientation.requestPermission());
  if (typeof motion?.requestPermission === 'function') requests.push(motion.requestPermission());
  return Promise.all(requests).then(results => results.every(value => value === 'granted'));
}

export function useSensorPermission(notify: (message: string) => void) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const granted = useRef(false);

  useEffect(() => {
    const choice = safeGet(STORAGE_KEYS.sensors);
    if (choice === 'skipped') return;
    const capable = 'DeviceOrientationEvent' in window || 'DeviceMotionEvent' in window;
    const { orientation, motion } = targets();
    // Safari может сбросить фактический доступ, хотя localStorage помнит выбор,
    // поэтому на iOS спрашиваем заново при каждом открытии страницы.
    const needsFresh = typeof orientation?.requestPermission === 'function' || typeof motion?.requestPermission === 'function';
    if (capable && window.matchMedia('(pointer: coarse)').matches && (!choice || needsFresh)) setShowPrompt(true);
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const ok = await requestSensorPermissions();
      granted.current = ok;
      safeSet(STORAGE_KEYS.sensors, ok ? 'granted' : 'denied');
      setShowPrompt(false);
      notify(ok ? 'Датчики движения включены.' : 'Доступ отклонён. Разрешите «Движение и ориентацию» в настройках Safari.');
    } catch {
      safeSet(STORAGE_KEYS.sensors, 'denied');
      setShowPrompt(false);
      notify('Не удалось включить датчики. Можно открыть и выпить зелье кнопками.');
    } finally {
      setBusy(false);
    }
  }, [notify]);

  const skip = useCallback(() => {
    safeSet(STORAGE_KEYS.sensors, 'skipped');
    setShowPrompt(false);
  }, []);

  /** Вызывайте прямо из обработчика жеста, до любых await. */
  const ensure = useCallback(async (): Promise<boolean> => {
    if (granted.current || safeGet(STORAGE_KEYS.sensors) === 'skipped') return true;
    try {
      const ok = await requestSensorPermissions();
      granted.current = ok;
      if (ok) return true;
      notify('Сначала разрешите доступ к датчикам движения.');
    } catch {
      notify('Safari не дал доступ к датчикам движения.');
    }
    setShowPrompt(true);
    return false;
  }, [notify]);

  return { showPrompt, busy, enable, skip, ensure };
}

export type SensorPermission = ReturnType<typeof useSensorPermission>;
