'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MasterView from './components/MasterView';
import PlayerView from './components/PlayerView';
import PrintOverlay from './components/PrintOverlay';
import ScannerDialog from './components/ScannerDialog';
import SensorPrompt from './components/SensorPrompt';
import { MAX_PER_POTION } from './constants';
import { useInventory } from './hooks/useInventory';
import type { RitualPhase } from './hooks/useRitual';
import { useSensorPermission } from './hooks/useSensorPermission';
import { useToast } from './hooks/useToast';
import { api, errorMessage } from './lib/api';
import { claimTarget, parseClaimTarget, parseClaimTargetFromUrl } from './lib/claim';
import { getDeviceId } from './lib/storage';
import type { Potion, PrintBundle, PrintItem } from './types';

type PrintState = { items: PrintItem[]; bundle: PrintBundle | null };

export default function PrototypeApp({ catalog }: { catalog: Potion[] }) {
  const [mode, setMode] = useState<'master' | 'player'>('master');
  const [deviceId, setDeviceId] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [print, setPrint] = useState<PrintState | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [ritualPhase, setRitualPhase] = useState<RitualPhase>('idle');
  const claimStarted = useRef(false);

  const { toast, notify } = useToast();
  const sensors = useSensorPermission(notify);

  const inventory = useInventory({
    deviceId,
    enabled: mode === 'player' && !!deviceId,
    paused: ritualPhase === 'pouring' || ritualPhase === 'result' || ritualPhase === 'failed',
    notify,
  });
  const { refresh } = inventory;

  const levelById = useMemo(() => new Map(catalog.map((potion, index) => [potion.id, index])), [catalog]);
  const total = useMemo(() => Object.values(cart).reduce((sum, value) => sum + value, 0), [cart]);

  // Выбор режима и привязка устройства — один раз при загрузке.
  useEffect(() => {
    const wantsClaim = parseClaimTarget(new URLSearchParams(location.hash.slice(1)));
    if (wantsClaim || new URLSearchParams(location.search).has('player')) setMode('player');
    const device = getDeviceId();
    setDeviceId(device.id);
    if (!device.persistent) notify('Хранилище браузера недоступно: инвентарь пропадёт после закрытия вкладки.');
  }, [notify]);

  // Получение зелья по ссылке из QR-кода.
  useEffect(() => {
    if (!deviceId || claimStarted.current) return;
    const target = parseClaimTarget(new URLSearchParams(location.hash.slice(1)));
    if (!target) return;
    claimStarted.current = true;
    claimTarget(target, deviceId)
      .then(message => {
        notify(message);
        history.replaceState(null, '', `${location.pathname}?player=1`);
      })
      .catch(error => notify(errorMessage(error, 'Не удалось забрать зелье')))
      .finally(() => void refresh({ force: true }));
  }, [deviceId, notify, refresh]);

  const changeQuantity = useCallback((id: string, delta: number) => {
    setCart(current => {
      const next = Math.max(0, Math.min(MAX_PER_POTION, (current[id] || 0) + delta));
      const updated = { ...current, [id]: next };
      if (!next) delete updated[id];
      return updated;
    });
  }, []);

  async function createPrintBatch() {
    if (!total) return notify('Сначала добавьте хотя бы одно зелье.');
    setBusy(true);
    try {
      const items = Object.entries(cart).map(([potionId, quantity]) => ({ potionId, quantity }));
      const data = await api<{ items: PrintItem[]; bundle: PrintBundle }>({ action: 'create_batch', items });
      setPrint({ items: data.items, bundle: data.bundle });
      notify(`Создано бирок: ${data.items.length}`);
    } catch (error) {
      notify(errorMessage(error, 'Не удалось создать печатный набор'));
    } finally {
      setBusy(false);
    }
  }

  const handleScan = useCallback(async (raw: string) => {
    setScannerOpen(false);
    const target = parseClaimTargetFromUrl(raw, location.href);
    if (!target) { notify('В этом QR-коде нет зелья'); return; }
    try {
      notify(await claimTarget(target, deviceId));
      await refresh({ force: true });
    } catch (error) {
      notify(errorMessage(error, 'Не удалось прочитать QR-код'));
    }
  }, [deviceId, notify, refresh]);

  const handleScanError = useCallback((error: unknown) => {
    setScannerOpen(false);
    notify(error instanceof DOMException && error.name === 'NotAllowedError'
      ? 'Разрешите доступ к камере в настройках браузера.'
      : 'Не удалось открыть камеру.');
  }, [notify]);

  const immersive = mode === 'player' && ritualPhase !== 'idle';

  return <div className={`site-shell ${immersive ? 'potion-immersive' : ''}`}>
    <header className="site-header">
      <button className="brand-button" onClick={() => setMode('master')}><span>✧</span><strong>Алхимический архив<small>ПРОТОТИП КАТАЛОГА ЗЕЛИЙ</small></strong></button>
      <nav aria-label="Режим просмотра">
        <button className={mode === 'master' ? 'active' : ''} aria-pressed={mode === 'master'} onClick={() => setMode('master')}>Каталог мастера</button>
        <button className={mode === 'player' ? 'active' : ''} aria-pressed={mode === 'player'} onClick={() => setMode('player')}>Инвентарь игрока <b>{inventory.items.length}</b></button>
      </nav>
    </header>

    {mode === 'master'
      ? <MasterView catalog={catalog} cart={cart} total={total} busy={busy} onChange={changeQuantity} onCreate={createPrintBatch} />
      : <PlayerView
          deviceId={deviceId} items={inventory.items} ready={inventory.ready} levelById={levelById}
          sensors={sensors} notify={notify}
          onRefresh={() => void refresh({ quiet: true })}
          onConsumed={inventory.markConsumed}
          onRitualClosed={() => void refresh({ quiet: true, force: true })}
          onPhaseChange={setRitualPhase}
          onScan={() => setScannerOpen(true)}
        />}

    {print && <PrintOverlay items={print.items} bundle={print.bundle} onClose={() => setPrint(null)} />}
    {sensors.showPrompt && mode === 'player' && <SensorPrompt busy={sensors.busy} onEnable={sensors.enable} onSkip={sensors.skip} />}
    {scannerOpen && <ScannerDialog onScan={handleScan} onError={handleScanError} onClose={() => setScannerOpen(false)} />}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}
