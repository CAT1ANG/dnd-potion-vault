'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { POLL_INTERVAL_MS } from '../constants';
import { errorMessage, fetchInventory, isAbort } from '../lib/api';
import type { InventoryItem } from '../types';

type Options = {
  deviceId: string;
  enabled: boolean;                 // поллинг идёт только в режиме игрока
  paused: boolean;                  // не трогаем инвентарь, пока зелье выпивается
  notify: (message: string) => void;
};
type RefreshOptions = { quiet?: boolean; force?: boolean };

export function useInventory({ deviceId, enabled, paused, notify }: Options) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [ready, setReady] = useState(false);

  // ready держим ещё и в ref, чтобы refresh не пересоздавался и не перезапускал интервал.
  const readyRef = useRef(false);
  const previousIds = useRef<Set<string>>(new Set());
  const requestSeq = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const pausedRef = useRef(paused);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const refresh = useCallback(async ({ quiet = false, force = false }: RefreshOptions = {}) => {
    if (!deviceId || (pausedRef.current && !force)) return;

    controller.current?.abort();            // устаревший запрос больше не нужен
    const current = new AbortController();
    controller.current = current;
    const seq = ++requestSeq.current;

    try {
      const next = await fetchInventory(deviceId, current.signal);
      if (seq !== requestSeq.current) return;              // пришёл не по порядку
      if (pausedRef.current && !force) return;             // ритуал начался, пока шёл запрос

      const nextIds = new Set(next.map(item => item.id));
      if (readyRef.current && [...previousIds.current].some(id => !nextIds.has(id))) {
        notify('Один флакон покинул этот инвентарь — его отсканировал другой игрок.');
      }
      previousIds.current = nextIds;
      setItems(next);
      if (!readyRef.current) { readyRef.current = true; setReady(true); }
    } catch (error) {
      if (isAbort(error)) return;
      if (!quiet) notify(errorMessage(error, 'Не удалось обновить инвентарь'));
    }
  }, [deviceId, notify]);

  /** Флакон выпит этим игроком: его исчезновение не повод для сообщения «забрал другой игрок». */
  const markConsumed = useCallback((itemId: string) => { previousIds.current.delete(itemId); }, []);

  useEffect(() => {
    if (!enabled || !deviceId) return;
    const tick = () => { if (!document.hidden) void refresh({ quiet: true }); };
    tick();
    const timer = window.setInterval(tick, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', tick);   // при возврате на вкладку обновляемся сразу
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      controller.current?.abort();
    };
  }, [enabled, deviceId, refresh]);

  return { items, ready, refresh, markConsumed };
}
