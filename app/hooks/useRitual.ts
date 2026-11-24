'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { DRAIN_START_DELAY_MS, POUR_ANIMATION_MS } from '../constants';
import { ApiError, NETWORK_ERROR, api, errorMessage } from '../lib/api';
import { createUuid } from '../lib/storage';
import type { ConsumeResult, InventoryItem } from '../types';

/**
 * Конечный автомат ритуала:
 * idle → opened → pouring → result
 *                    ↓ (сбой сети)
 *                  failed → (повтор) → pouring
 */
export type RitualPhase = 'idle' | 'opened' | 'pouring' | 'result' | 'failed';
type State = { phase: RitualPhase; item: InventoryItem | null; drained: boolean; result: ConsumeResult | null; error: string | null };
type Action =
  | { type: 'open'; item: InventoryItem }
  | { type: 'cancel' }
  | { type: 'pour' }
  | { type: 'drain' }
  | { type: 'done'; result: ConsumeResult }
  | { type: 'fail'; message: string }
  | { type: 'retry' }
  | { type: 'reset' };

const initialState: State = { phase: 'idle', item: null, drained: false, result: null, error: null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'open': return state.phase === 'idle' ? { ...initialState, phase: 'opened', item: action.item } : state;
    case 'cancel': return state.phase === 'opened' ? initialState : state;
    case 'pour': return state.phase === 'opened' ? { ...state, phase: 'pouring', drained: false, error: null } : state;
    case 'drain': return state.phase === 'pouring' ? { ...state, drained: true } : state;
    case 'done': return state.phase === 'pouring' ? { ...state, phase: 'result', result: action.result } : state;
    case 'fail': return state.phase === 'pouring' ? { ...state, phase: 'failed', error: action.message } : state;
    case 'retry': return state.phase === 'failed' ? { ...state, phase: 'pouring', error: null } : state;
    case 'reset': return initialState;
  }
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

type Options = {
  deviceId: string;
  notify: (message: string) => void;
  onConsumed: (itemId: string) => void;
  onClosed: () => void;
};

export function useRitual({ deviceId, notify, onConsumed, onClosed }: Options) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  const onConsumedRef = useRef(onConsumed);
  const onClosedRef = useRef(onClosed);
  useEffect(() => { stateRef.current = state; onConsumedRef.current = onConsumed; onClosedRef.current = onClosed; });

  const inFlight = useRef(false);
  const pending = useRef<{ requestId: string } | null>(null);
  const drainTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (drainTimer.current) clearTimeout(drainTimer.current); }, []);

  const send = useCallback(async (item: InventoryItem, requestId: string, withAnimation: boolean) => {
    try {
      const [data] = await Promise.all([
        api<ConsumeResult>({ action: 'consume', itemId: item.id, deviceId, requestId }),
        withAnimation ? sleep(POUR_ANIMATION_MS) : Promise.resolve(),
      ]);
      pending.current = null;
      onConsumedRef.current(item.id);
      dispatch({ type: 'done', result: data });
    } catch (error) {
      // Сеть или 5xx: сервер мог выпить зелье, поэтому даём повторить с тем же requestId.
      const retryable = !(error instanceof ApiError) || error.status === 0 || error.status >= 500;
      if (retryable) {
        dispatch({ type: 'fail', message: errorMessage(error, NETWORK_ERROR) });
      } else {
        pending.current = null;
        notify(errorMessage(error, 'Магия прервалась'));
        dispatch({ type: 'reset' });
        onClosedRef.current();
      }
    } finally {
      inFlight.current = false;
    }
  }, [deviceId, notify]);

  const open = useCallback((item: InventoryItem) => dispatch({ type: 'open', item }), []);
  const cancel = useCallback(() => dispatch({ type: 'cancel' }), []);

  const consume = useCallback(() => {
    const current = stateRef.current;
    if (inFlight.current || current.phase !== 'opened' || !current.item) return;
    inFlight.current = true;
    const requestId = createUuid();
    pending.current = { requestId };
    dispatch({ type: 'pour' });
    drainTimer.current = setTimeout(() => dispatch({ type: 'drain' }), DRAIN_START_DELAY_MS);
    void send(current.item, requestId, true);
  }, [send]);

  const retry = useCallback(() => {
    const current = stateRef.current;
    if (inFlight.current || current.phase !== 'failed' || !current.item || !pending.current) return;
    inFlight.current = true;
    dispatch({ type: 'retry' });
    void send(current.item, pending.current.requestId, false);
  }, [send]);

  const close = useCallback(() => {
    const current = stateRef.current;
    // Закрыли после сбоя: флакон мог быть выпит, не считаем его «уведённым другим игроком».
    if (current.phase === 'failed' && current.item) onConsumedRef.current(current.item.id);
    pending.current = null;
    inFlight.current = false;
    dispatch({ type: 'reset' });
    onClosedRef.current();
  }, []);

  return { state, open, cancel, consume, retry, close };
}
