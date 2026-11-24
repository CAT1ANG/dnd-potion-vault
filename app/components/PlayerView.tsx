'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import Bottle from '../Bottle';
import {
  DRAG_EASING, DRAG_RUBBER_BAND, DRAG_SETTLE_PX, DRAG_START_PX,
  SWIPE_HORIZONTAL_MAX_PX, SWIPE_HORIZONTAL_MIN_PX, SWIPE_HORIZONTAL_VIEWPORT_RATIO, SWIPE_VERTICAL_MIN_PX,
} from '../constants';
import type { SensorPermission } from '../hooks/useSensorPermission';
import { useRitual, type RitualPhase } from '../hooks/useRitual';
import { useTiltSensor } from '../hooks/useTiltSensor';
import { api, errorMessage } from '../lib/api';
import type { InventoryItem, ShareCode } from '../types';
import Modal from './Modal';

type Props = {
  deviceId: string;
  items: InventoryItem[];
  ready: boolean;
  levelById: Map<string, number>;
  sensors: SensorPermission;
  notify: (message: string) => void;
  onRefresh: () => void;
  onConsumed: (itemId: string) => void;
  onRitualClosed: () => void;
  onPhaseChange: (phase: RitualPhase) => void;
  onScan: () => void;
};

type Gesture = { x: number; y: number; upperHalf: boolean };

// Кнопки внутри страницы с pointer capture не должны начинать свайп.
const stopPointer = { onPointerDown: (event: ReactPointerEvent) => event.stopPropagation() };

/** inert выключает фокус и чтение скринридером у соседних карточек (работает и в React 18, и в 19). */
const inertRef = (inactive: boolean) => (el: HTMLElement | null) => {
  if (!el) return;
  if (inactive) el.setAttribute('inert', ''); else el.removeAttribute('inert');
};

export default function PlayerView({
  deviceId, items, ready, levelById, sensors, notify,
  onRefresh, onConsumed, onRitualClosed, onPhaseChange, onScan,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [shareCode, setShareCode] = useState<ShareCode | null>(null);

  const ritual = useRitual({ deviceId, notify, onConsumed, onClosed: onRitualClosed });
  const { state, cancel: cancelRitual } = ritual;
  const opened = state.phase === 'opened';
  const drinking = state.phase === 'pouring' || state.phase === 'result' || state.phase === 'failed';

  // Индекс вычисляется на лету, без «лишнего кадра» из-за эффекта-коррекции.
  const index = items.length ? Math.min(selectedIndex, items.length - 1) : 0;
  const activeItem = items[index] ?? null;

  const stageRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const drag = useRef<{ target: number; visual: number; frame: number | null }>({ target: 0, visual: 0, frame: null });
  const opening = useRef(false);

  // --- Состояние ритуала наружу -----------------------------------------
  useEffect(() => { onPhaseChange(state.phase); }, [state.phase, onPhaseChange]);
  useEffect(() => () => onPhaseChange('idle'), [onPhaseChange]);

  // --- Блокировка прокрутки классом, а не запоминанием inline-стилей -----
  useEffect(() => {
    document.documentElement.classList.add('player-lock');
    return () => document.documentElement.classList.remove('player-lock');
  }, []);

  // --- Наклон: пишем в CSS-переменную, без React-рендера на каждое событие ---
  const setTilt = useCallback((value: number) => {
    stageRef.current?.style.setProperty('--tilt', String(value));
  }, []);
  useTiltSensor({ active: opened, onTilt: setTilt, onTrigger: ritual.consume });

  // --- Если открытый флакон пропал из инвентаря — закрываем ритуал --------
  useEffect(() => {
    if (opened && ready && state.item && !items.some(item => item.id === state.item!.id)) cancelRitual();
  }, [opened, ready, items, state.item, cancelRitual]);
  useEffect(() => {
    if (shareCode && ready && !items.some(item => item.id === shareCode.itemId)) setShareCode(null);
  }, [shareCode, ready, items]);

  // --- Перетаскивание карточек: прямое обновление CSS-переменной -----------
  const applyDrag = useCallback((px: number) => {
    stageRef.current?.style.setProperty('--drag-x', `${px}px`);
  }, []);
  const stopDrag = useCallback(() => {
    const d = drag.current;
    if (d.frame != null) cancelAnimationFrame(d.frame);
    d.frame = null; d.target = 0; d.visual = 0;
    applyDrag(0);
  }, [applyDrag]);
  const smoothDragTo = useCallback((target: number) => {
    const d = drag.current;
    d.target = target;
    if (d.frame != null) return;
    const step = () => {
      const distance = d.target - d.visual;
      d.visual = Math.abs(distance) < DRAG_SETTLE_PX ? d.target : d.visual + distance * DRAG_EASING;
      applyDrag(d.visual);
      d.frame = Math.abs(d.target - d.visual) > DRAG_SETTLE_PX ? requestAnimationFrame(step) : null;
    };
    d.frame = requestAnimationFrame(step);
  }, [applyDrag]);
  useEffect(() => () => { const d = drag.current; if (d.frame != null) cancelAnimationFrame(d.frame); }, []);

  // --- Действия -------------------------------------------------------------
  const go = (delta: number) => {
    if (items.length < 2 || opened || drinking) return;
    setSelectedIndex(Math.max(0, Math.min(items.length - 1, index + delta)));
    navigator.vibrate?.(12);
  };

  async function openBottle() {
    if (!activeItem || state.phase !== 'idle' || opening.current || shareCode) return;
    opening.current = true;
    const item = activeItem;
    try {
      // ensure() вызывается синхронно из жеста: запрос разрешения должен успеть до первого await.
      if (!(await sensors.ensure())) return;
      ritual.open(item);
      navigator.vibrate?.([25, 20, 35]);
    } finally {
      opening.current = false;
    }
  }

  function closeBottle() {
    if (!opened) return;
    ritual.cancel();
    navigator.vibrate?.(18);
  }

  async function toggleShare(item: InventoryItem) {
    if (shareCode?.itemId === item.id) { setShareCode(null); return; }
    try {
      const data = await api<{ url: string; qr: string }>({ action: 'share', itemId: item.id, deviceId });
      setShareCode({ itemId: item.id, ...data });
    } catch (error) {
      notify(errorMessage(error, 'Не удалось создать QR-код передачи'));
      onRefresh();
    }
  }

  // --- Жесты ------------------------------------------------------------------
  const blocked = drinking || !!shareCode;

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (blocked) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    gesture.current = { x: event.clientX, y: event.clientY, upperHalf: event.clientY < bounds.top + bounds.height / 2 };
    stopDrag();
    setDragging(false);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const start = gesture.current;
    if (!start || opened || blocked || items.length < 2) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < DRAG_START_PX || Math.abs(dx) <= Math.abs(dy)) return;
    const beyondStart = index === 0 && dx > 0;
    const beyondEnd = index === items.length - 1 && dx < 0;
    setDragging(true);
    smoothDragTo(beyondStart || beyondEnd ? dx * DRAG_RUBBER_BAND : dx);
  }

  function onPointerEnd(event: ReactPointerEvent<HTMLElement>) {
    const start = gesture.current;
    gesture.current = null;
    setDragging(false);
    stopDrag();
    if (!start || !activeItem || blocked) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const horizontal = Math.abs(dx) > Math.abs(dy);
    const threshold = Math.min(SWIPE_HORIZONTAL_MAX_PX, Math.max(SWIPE_HORIZONTAL_MIN_PX, event.currentTarget.clientWidth * SWIPE_HORIZONTAL_VIEWPORT_RATIO));

    if (!opened && horizontal && Math.abs(dx) > threshold) { go(dx < 0 ? 1 : -1); return; }
    if (opened && start.upperHalf && !horizontal && dy > SWIPE_VERTICAL_MIN_PX) { closeBottle(); return; }
    if (start.upperHalf && !horizontal && dy < -SWIPE_VERTICAL_MIN_PX) {
      if (!opened) void openBottle(); else ritual.consume();
    }
  }

  const statusText =
    state.phase === 'opened' ? 'Флакон открыт. Наклоните телефон или нажмите «Выпить».'
    : state.phase === 'pouring' ? 'Зелье выпивается…'
    : state.phase === 'result' ? 'Магия свершилась.'
    : state.phase === 'failed' ? 'Связь прервалась.'
    : '';

  const hint = opened
    ? 'Наклоните телефон или нажмите «Выпить». Свайп вниз закроет флакон.'
    : 'Свайп вверх открывает флакон, свайп вбок выбирает другой.';

  const potionStyle = (color: string) => ({ '--potion-color': color }) as CSSProperties;

  return <>
    <main
      className={`player-page ${opened ? 'opened' : ''} ${drinking ? 'pouring' : ''} ${dragging ? 'inventory-dragging' : ''}`}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd}
      onPointerCancel={() => { gesture.current = null; setDragging(false); stopDrag(); }}
    >
      <div className="page-title player-title"><p>ЛИЧНАЯ СУМКА ПРИКЛЮЧЕНЦА</p><h1>Мои зелья</h1></div>
      <button className="inventory-scan-button" type="button" aria-label="Отсканировать новый QR-код" title="Отсканировать новый QR-код"
        {...stopPointer} onClick={event => { event.stopPropagation(); onScan(); }}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4.5 10.3 3h3.4L15 4.5h3.2A2.8 2.8 0 0 1 21 7.3v10.4a2.8 2.8 0 0 1-2.8 2.8H5.8A2.8 2.8 0 0 1 3 17.7V7.3a2.8 2.8 0 0 1 2.8-2.8H9Zm3 3.2a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4Zm0 2a2.7 2.7 0 1 1 0 5.4 2.7 2.7 0 0 1 0-5.4Z" /></svg>
      </button>

      <div className="visually-hidden" aria-live="polite" role="status">{statusText}</div>

      {!ready
        ? <div className="inventory-empty"><span>✦</span><h2>Проверяем печати…</h2></div>
        : !items.length
          ? <div className="inventory-empty"><span>☾</span><h2>Инвентарь пуст</h2><p>Отсканируйте бирку зелья обычной камерой телефона.</p></div>
          : <>
            <div className="inventory-stage" ref={stageRef}>
              {items.map((item, i) => {
                if (Math.abs(i - index) > 1) return null; // рендерим только текущую и соседние карточки
                const isActive = i === index;
                const showingQr = shareCode?.itemId === item.id;
                return <article
                  className={`inventory-card ${isActive ? 'active' : ''}`} key={item.id}
                  ref={inertRef(!isActive)} aria-hidden={!isActive}
                  style={{ '--potion-color': item.potion.color, '--card-offset': i - index, opacity: isActive ? 1 : 0.28 } as CSSProperties}
                >
                  <p>{item.potion.rarity} · ФЛАКОН {i + 1} ИЗ {items.length}</p>
                  <button
                    className={`inventory-qr-toggle ${showingQr ? 'active' : ''}`} disabled={!isActive || state.phase !== 'idle'}
                    {...stopPointer} onClick={() => toggleShare(item)}
                    aria-label={showingQr ? 'Скрыть QR-код передачи' : 'Показать QR-код передачи'} title={showingQr ? 'Скрыть QR-код' : 'Показать QR-код'}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h7v7H3V3Zm2 2v3h3V5H5Zm9-2h7v7h-7V3Zm2 2v3h3V5h-3ZM3 14h7v7H3v-7Zm2 2v3h3v-3H5Zm9-2h3v3h-3v-3Zm4 0h3v3h-3v-3Zm-4 4h3v3h-3v-3Zm4 0h1v1h2v2h-4v-3Z" /></svg>
                  </button>
                  <div className={`inventory-visual ${showingQr ? 'showing-qr' : ''}`}>
                    <div className="inventory-bottle-shell">
                      <Bottle level={levelById.get(item.potion.id) ?? 0} fill={isActive && state.drained ? 0 : 1} draining={drinking && isActive} />
                    </div>
                    {showingQr && shareCode && <div className="inventory-qr">
                      <img src={shareCode.qr} alt={`QR-код передачи: ${item.potion.fullName}`} />
                      <strong>Передать зелье</strong><span>Пусть другой игрок отсканирует этот код</span>
                    </div>}
                  </div>
                  <div className="inventory-copy">
                    <h2>{item.potion.fullName}</h2><strong>{item.potion.formula}</strong><span>{item.potion.range} здоровья</span>
                    {opened && isActive && <div className="inventory-ritual-progress" role="progressbar" aria-label="Наклон флакона">
                      <i style={{ width: 'calc(var(--tilt, 0) * 100%)' }} />
                    </div>}
                  </div>
                </article>;
              })}
            </div>

            {!drinking && <>
              <p className="inventory-hint">{hint}</p>
              <div className="inventory-actions" {...stopPointer}>
                {!opened ? <>
                  {items.length > 1 && <button type="button" className="secondary-action" aria-label="Предыдущий флакон" disabled={index === 0 || !!shareCode} onClick={() => go(-1)}>‹</button>}
                  <button type="button" className="primary-action" disabled={!!shareCode} onClick={() => void openBottle()}>Открыть флакон</button>
                  {items.length > 1 && <button type="button" className="secondary-action" aria-label="Следующий флакон" disabled={index === items.length - 1 || !!shareCode} onClick={() => go(1)}>›</button>}
                </> : <>
                  <button type="button" className="secondary-action" onClick={closeBottle}>Закрыть флакон</button>
                  <button type="button" className="primary-action" onClick={ritual.consume}>Выпить</button>
                </>}
              </div>
            </>}
          </>}
    </main>

    {state.phase === 'result' && state.result && <Modal className="ritual-overlay" label="Результат зелья" onClose={ritual.close}>
      <div className="result-card" style={potionStyle(state.result.potion.color)}>
        <p>ЗЕЛЬЕ ВЫПИТО</p><h1>Магия свершилась</h1>
        <div className="result-amount">+{state.result.outcome.amount}<span>♥</span></div><small>ОЧКОВ ЗДОРОВЬЯ</small>
        <div className="result-dice">{state.result.outcome.dice.map((die, i) => <i key={i}>{die}</i>)}<b>+ {state.result.outcome.bonus}</b></div>
        <button className="primary-action" onClick={ritual.close}>Вернуться в инвентарь</button>
      </div>
    </Modal>}

    {state.phase === 'failed' && state.item && <Modal className="ritual-overlay" label="Связь прервалась" onClose={ritual.close}>
      <div className="result-card" style={potionStyle(state.item.potion.color)}>
        <p>СВЯЗЬ ПРЕРВАНА</p><h1>Результат не получен</h1>
        <small>{state.error} Нажмите «Повторить», чтобы запросить результат снова.</small>
        <button className="primary-action" onClick={ritual.retry}>Повторить</button>
        <button className="secondary-action" onClick={ritual.close}>Закрыть</button>
      </div>
    </Modal>}
  </>;
}
