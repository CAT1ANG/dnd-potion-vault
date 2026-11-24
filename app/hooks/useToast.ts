'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TOAST_MS } from '../constants';

/** Один таймер на всё: новое уведомление сбрасывает прежний, при размонтировании таймер чистится. */
export function useToast() {
  const [toast, setToast] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(message);
    timer.current = setTimeout(() => { setToast(''); timer.current = null; }, TOAST_MS);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { toast, notify };
}
