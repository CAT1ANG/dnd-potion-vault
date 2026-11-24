'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Bottle from './Bottle';

type Potion = {
  id:string; category:string; name:string; fullName:string; rarity:string;
  color:string; shape:string; interaction:string; range:string; formula:string;
};
type InventoryItem = {id:string; claimedAt:string; potion:Potion};
type PrintItem = {id:string; number:number; potion:Potion; url:string; qr:string};
type PrintBundle = {url:string; qr:string; itemCount:number};
type Outcome = {amount:number; dice:number[]; bonus:number; formula:string};
type ShareCode = {itemId:string; url:string; qr:string};

const API = '/api/prototype';

function levelFor(catalog:Potion[], potion:Potion) {
  const index = catalog.findIndex(item => item.id === potion.id);
  return index < 0 ? 0 : index;
}

function getDeviceId() {
  const key = 'dnd-potion-device';
  let value = localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(key,value);
  }
  return value;
}

async function api<T>(body:Record<string,unknown>):Promise<T> {
  const response = await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data = await response.json().catch(() => ({})) as T & {error?:string};
  if (!response.ok) throw new Error(data.error || 'Не удалось связаться с лабораторией');
  return data;
}

function PrintTag({item}:{item:PrintItem}) {
  return <article className="print-tag" style={{'--potion-color':item.potion.color} as React.CSSProperties}>
    <svg className="tag-frame" viewBox="0 0 1000 310" preserveAspectRatio="none" aria-hidden="true">
      <path d="M115 8H970L992 32V278L970 302H115L8 242V68Z" />
      <path d="M124 21H960L979 41V269L960 289H124L23 234V76Z" />
    </svg>
    <div className="tag-seal" aria-hidden="true"><span>✦</span><i>△</i><span>✦</span></div>
    <div className="tag-copy">
      <div className="tag-ornament">— • ☾ • —</div>
      <p>{item.potion.rarity} · Алхимическая печать №{String(item.number).padStart(2,'0')}</p>
      <h2>{item.potion.fullName}</h2>
      <div className="tag-rule">✦</div>
      <strong>{item.potion.formula}</strong><span>Восстанавливает {item.potion.range} очков здоровья</span>
      <div className="tag-ornament">— • ◡ • —</div>
    </div>
    <div className="tag-qr"><img src={item.qr} alt={`QR-код: ${item.potion.fullName}`} /><small>СКАНИРОВАТЬ</small></div>
  </article>;
}

function BundleTag({bundle}:{bundle:PrintBundle}) {
  return <article className="print-tag bundle-tag" style={{'--potion-color':'#8c0000'} as React.CSSProperties}>
    <svg className="tag-frame" viewBox="0 0 1000 310" preserveAspectRatio="none" aria-hidden="true">
      <path d="M115 8H970L992 32V278L970 302H115L8 242V68Z" />
      <path d="M124 21H960L979 41V269L960 289H124L23 234V76Z" />
    </svg>
    <div className="tag-seal" aria-hidden="true"><span>✦</span><i>✧</i><span>✦</span></div>
    <div className="tag-copy">
      <div className="tag-ornament">— • ☾ • —</div>
      <p>ЕДИНАЯ ПЕЧАТЬ · ОДНОРАЗОВАЯ АКТИВАЦИЯ</p>
      <h2>Весь набор зелий</h2>
      <div className="tag-rule">✦</div>
      <strong>{bundle.itemCount} флаконов</strong><span>Одно сканирование добавит весь набор в инвентарь</span>
      <div className="tag-ornament">— • ◡ • —</div>
    </div>
    <div className="tag-qr"><img src={bundle.qr} alt={`QR-код набора из ${bundle.itemCount} зелий`} /><small>ЗАБРАТЬ ВЕСЬ НАБОР</small></div>
  </article>;
}

export default function PrototypeApp({catalog}:{catalog:Potion[]}) {
  const [mode,setMode] = useState<'master'|'player'>('master');
  const [cart,setCart] = useState<Record<string,number>>({});
  const [busy,setBusy] = useState(false);
  const [printItems,setPrintItems] = useState<PrintItem[]>([]);
  const [printBundle,setPrintBundle] = useState<PrintBundle|null>(null);
  const [printOpen,setPrintOpen] = useState(false);
  const [deviceId,setDeviceId] = useState('');
  const [inventory,setInventory] = useState<InventoryItem[]>([]);
  const [inventoryReady,setInventoryReady] = useState(false);
  const [selectedIndex,setSelectedIndex] = useState(0);
  const [dragX,setDragX] = useState(0);
  const [dragging,setDragging] = useState(false);
  const [toast,setToast] = useState('');
  const [sensorPrompt,setSensorPrompt] = useState(false);
  const [sensorBusy,setSensorBusy] = useState(false);
  const [scannerOpen,setScannerOpen] = useState(false);
  const [scannerStarting,setScannerStarting] = useState(false);
  const [ritualItem,setRitualItem] = useState<InventoryItem|null>(null);
  const [shareCode,setShareCode] = useState<ShareCode|null>(null);
  const [opened,setOpened] = useState(false);
  const [pouring,setPouring] = useState(false);
  const [tilt,setTilt] = useState(0);
  const [liquidDrain,setLiquidDrain] = useState(0);
  const [result,setResult] = useState<{potion:Potion;outcome:Outcome}|null>(null);
  const previousIds = useRef<Set<string>>(new Set());
  const screenGesture = useRef<{x:number;y:number;upperHalf:boolean}|null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const sensorTilt = useRef(0);
  const scannerVideo = useRef<HTMLVideoElement|null>(null);
  const scannerHandled = useRef(false);
  const pouringRef = useRef(false);

  const total = useMemo(() => Object.values(cart).reduce((sum,value) => sum + value,0),[cart]);
  const activeItem = inventory.length ? inventory[Math.min(selectedIndex,inventory.length-1)] : null;

  useEffect(() => {
    if (selectedIndex >= inventory.length) setSelectedIndex(Math.max(0,inventory.length-1));
  },[inventory.length,selectedIndex]);

  const notify = useCallback((message:string) => {
    setToast(message);
    window.setTimeout(() => setToast(current => current === message ? '' : current),3200);
  },[]);

  const refreshInventory = useCallback(async (id = deviceId, quiet = false) => {
    if (!id) return;
    try {
      const response = await fetch(`${API}?deviceId=${encodeURIComponent(id)}`,{cache:'no-store'});
      const data = await response.json() as {items?:InventoryItem[];error?:string};
      if (!response.ok) throw new Error(data.error || 'Не удалось обновить инвентарь');
      const next = data.items || [];
      const nextIds = new Set(next.map(item => item.id));
      if (inventoryReady && [...previousIds.current].some(itemId => !nextIds.has(itemId)) && !pouringRef.current) {
        notify('Один флакон покинул этот инвентарь — его отсканировал другой игрок.');
      }
      previousIds.current = nextIds;
      setInventory(next);
      setInventoryReady(true);
    } catch (error) {
      if (!quiet) notify(error instanceof Error ? error.message : 'Не удалось обновить инвентарь');
    }
  },[deviceId,inventoryReady,notify]);

  useEffect(() => {
    const id = getDeviceId();
    setDeviceId(id);
    const sensorChoice=localStorage.getItem('dnd-potion-sensors');
    const sensorCapable='DeviceOrientationEvent' in window || 'DeviceMotionEvent' in window;
    if (!sensorChoice && sensorCapable && window.matchMedia('(pointer: coarse)').matches) setSensorPrompt(true);
    const hash = new URLSearchParams(location.hash.slice(1));
    const token = hash.get('p');
    const sharedItem = hash.get('s');
    const bundleToken = hash.get('b');
    const playerRequested = token || sharedItem || bundleToken || new URLSearchParams(location.search).has('player');
    if (playerRequested) setMode('player');
    if (token || sharedItem || bundleToken) {
      const claim = token ? {action:'claim',token,deviceId:id} : sharedItem ? {action:'claim_share',itemId:sharedItem,deviceId:id} : {action:'claim_batch',token:bundleToken,deviceId:id};
      api<{transferred?:boolean;count?:number}>(claim)
        .then(data => {
          notify(bundleToken ? `Набор из ${data.count || 0} зелий добавлен в инвентарь.` : data.transferred ? 'Зелье перешло в ваш инвентарь от другого игрока.' : 'Зелье добавлено в инвентарь.');
          history.replaceState(null,'',`${location.pathname}?player=1`);
          return refreshInventory(id);
        })
        .catch(error => notify(error.message));
    } else if (playerRequested) refreshInventory(id);
  // Начальная привязка устройства выполняется один раз.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  useEffect(() => {
    if (mode !== 'player' || !deviceId) return;
    refreshInventory(deviceId,true);
    const timer = window.setInterval(() => refreshInventory(deviceId,true),2500);
    return () => window.clearInterval(timer);
  },[mode,deviceId,refreshInventory]);

  useEffect(() => {
    if (mode !== 'player') return;
    const htmlOverflow=document.documentElement.style.overflow;
    const bodyOverflow=document.body.style.overflow;
    document.documentElement.style.overflow='hidden';
    document.body.style.overflow='hidden';
    return () => {
      document.documentElement.style.overflow=htmlOverflow;
      document.body.style.overflow=bodyOverflow;
    };
  },[mode]);

  function changeQuantity(id:string, delta:number) {
    setCart(current => {
      const next = Math.max(0,Math.min(24,(current[id] || 0) + delta));
      const updated = {...current,[id]:next};
      if (!next) delete updated[id];
      return updated;
    });
  }

  async function createPrintBatch() {
    if (!total) return notify('Сначала добавьте хотя бы одно зелье.');
    setBusy(true);
    try {
      const items = Object.entries(cart).map(([potionId,quantity]) => ({potionId,quantity}));
      const data = await api<{items:PrintItem[];bundle:PrintBundle}>({action:'create_batch',items});
      setPrintItems(data.items);
      setPrintBundle(data.bundle);
      setPrintOpen(true);
      notify(`Создано бирок: ${data.items.length}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Не удалось создать печатный набор');
    } finally { setBusy(false); }
  }

  async function enableSensors() {
    setSensorBusy(true);
    try {
      const orientation = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {requestPermission?:()=>Promise<'granted'|'denied'>};
      const motion = window.DeviceMotionEvent as typeof DeviceMotionEvent & {requestPermission?:()=>Promise<'granted'|'denied'>};
      const requests = [orientation?.requestPermission?.(),motion?.requestPermission?.()].filter(Boolean) as Promise<string>[];
      const results=requests.length ? await Promise.all(requests) : ['granted'];
      const granted=results.every(value => value==='granted');
      localStorage.setItem('dnd-potion-sensors',granted?'granted':'denied');
      setSensorPrompt(false);
      notify(granted?'Датчики движения включены.':'Доступ к датчикам отклонён. Остаётся повторный свайп вверх.');
    } catch {
      localStorage.setItem('dnd-potion-sensors','denied');
      setSensorPrompt(false);
      notify('Не удалось включить датчики. Остаётся повторный свайп вверх.');
    } finally {
      setSensorBusy(false);
    }
  }

  function continueWithoutSensors() {
    localStorage.setItem('dnd-potion-sensors','skipped');
    setSensorPrompt(false);
  }

  async function toggleShare(item:InventoryItem) {
    if (shareCode?.itemId === item.id) return setShareCode(null);
    try {
      const data = await api<{url:string;qr:string}>({action:'share',itemId:item.id,deviceId});
      setShareCode({itemId:item.id,...data});
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Не удалось создать QR-код передачи');
      await refreshInventory(deviceId,true);
    }
  }

  const claimScannedCode = useCallback(async (rawValue:string) => {
    if (scannerHandled.current) return;
    scannerHandled.current=true;
    try {
      const scanned=new URL(rawValue,location.href);
      const hash=new URLSearchParams(scanned.hash.slice(1));
      const token=hash.get('p');
      const sharedItem=hash.get('s');
      const bundleToken=hash.get('b');
      if (!token && !sharedItem && !bundleToken) throw new Error('В этом QR-коде нет зелья');
      const claim=token ? {action:'claim',token,deviceId} : sharedItem ? {action:'claim_share',itemId:sharedItem,deviceId} : {action:'claim_batch',token:bundleToken,deviceId};
      const data=await api<{transferred?:boolean;count?:number}>(claim);
      setScannerOpen(false);
      notify(bundleToken?`Набор из ${data.count || 0} зелий добавлен в инвентарь.`:data.transferred?'Зелье перешло в ваш инвентарь от другого игрока.':'Зелье добавлено в инвентарь.');
      await refreshInventory(deviceId);
    } catch (error) {
      setScannerOpen(false);
      notify(error instanceof Error ? error.message : 'Не удалось прочитать QR-код');
    }
  },[deviceId,notify,refreshInventory]);

  useEffect(() => {
    if (!scannerOpen) return;
    let active=true;
    let controls:{stop:()=>void}|undefined;
    scannerHandled.current=false;
    setScannerStarting(true);
    void import('@zxing/browser').then(async ({BrowserQRCodeReader}) => {
      if (!active || !scannerVideo.current) return;
      const reader=new BrowserQRCodeReader();
      controls=await reader.decodeFromConstraints(
        {audio:false,video:{facingMode:{ideal:'environment'}}},
        scannerVideo.current,
        result => { if (result) void claimScannedCode(result.getText()); },
      );
      if (active) setScannerStarting(false);
      else controls.stop();
    }).catch(error => {
      if (!active) return;
      setScannerStarting(false);
      setScannerOpen(false);
      notify(error instanceof DOMException && error.name==='NotAllowedError'?'Разрешите доступ к камере в настройках браузера.':'Не удалось открыть камеру.');
    });
    return () => {
      active=false;
      controls?.stop();
      setScannerStarting(false);
    };
  },[scannerOpen,claimScannedCode,notify]);

  const closeRitual = useCallback(async () => {
    setRitualItem(null); setOpened(false); setPouring(false); setTilt(0); setLiquidDrain(0); setResult(null);
    sensorTilt.current = 0;
    pouringRef.current = false;
    await refreshInventory(deviceId,true);
  },[deviceId,refreshInventory]);

  const consume = useCallback(async () => {
    if (!ritualItem || pouringRef.current) return;
    pouringRef.current = true; setPouring(true); setTilt(1);
    window.setTimeout(() => setLiquidDrain(1),50);
    try {
      const [data] = await Promise.all([
        api<{potion:Potion;outcome:Outcome}>({action:'consume',itemId:ritualItem.id,deviceId}),
        new Promise(resolve => window.setTimeout(resolve,2200)),
      ]);
      setResult(data);
      await refreshInventory(deviceId,true);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Магия прервалась');
      await closeRitual();
    }
  },[ritualItem,deviceId,refreshInventory,notify,closeRitual]);

  useEffect(() => {
    if (!opened || !ritualItem || result) return;
    let lastOrientationAt=0;
    let lastUpdateAt=performance.now();
    let baselineGamma:number|null=null;
    let baselineGravityX:number|null=null;
    let orientationSamples=0;
    let motionSamples=0;

    function progress(target:number) {
      const now=performance.now();
      const elapsed=Math.min(80,Math.max(8,now-lastUpdateAt));
      lastUpdateAt=now;
      const smoothing=1-Math.pow(.94,elapsed/16.67);
      let next=sensorTilt.current+(target-sensorTilt.current)*smoothing;
      if (next < .025) next=0;
      sensorTilt.current=next;
      setTilt(current => Math.max(current,next));

      if (next > .94 && !holdTimer.current) holdTimer.current=setTimeout(consume,300);
      if (next <= .80 && holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current=null; }
    }
    function orientation(event:DeviceOrientationEvent) {
      if (event.gamma == null) return;
      lastOrientationAt=performance.now();
      if (orientationSamples < 12 || baselineGamma == null) {
        baselineGamma=baselineGamma==null?event.gamma:baselineGamma+(event.gamma-baselineGamma)/(orientationSamples+1);
        orientationSamples+=1;
        progress(0);
        return;
      }
      // Калибруемся относительно положения телефона при открытии пробки.
      // По реальному iPhone: вертикаль ≈ -5°, нужное ребро ≈ -88°.
      const degrees=Math.abs(event.gamma-baselineGamma);
      progress(Math.max(0,Math.min(1,(degrees-8)/(82-8))));
    }
    function motion(event:DeviceMotionEvent) {
      const gravity = event.accelerationIncludingGravity;
      if (!gravity || gravity.x == null || gravity.y == null || gravity.z == null) return;
      if (motionSamples < 12 || baselineGravityX == null) {
        baselineGravityX=baselineGravityX==null?gravity.x:baselineGravityX+(gravity.x-baselineGravityX)/(motionSamples+1);
        motionSamples+=1;
        return;
      }
      // DeviceOrientation обычно стабильнее. Акселерометр используем только
      // как запасной вариант, если события ориентации перестали приходить.
      if (performance.now()-lastOrientationAt < 500) return;
      const gravityDelta=Math.abs(gravity.x-baselineGravityX);
      progress(Math.max(0,Math.min(1,(gravityDelta-1)/(9.7-1))));
    }
    window.addEventListener('deviceorientation',orientation,{passive:true});
    window.addEventListener('devicemotion',motion,{passive:true});
    return () => {
      window.removeEventListener('deviceorientation',orientation);
      window.removeEventListener('devicemotion',motion);
      if (holdTimer.current) clearTimeout(holdTimer.current);
      holdTimer.current=null;
    };
  },[opened,ritualItem,result,consume]);

  async function openBottle(item:InventoryItem) {
    if (opened) return;
    sensorTilt.current=0;
    setTilt(0);
    setLiquidDrain(0);
    setRitualItem(item);
    setShareCode(null);
    const orientation = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {requestPermission?:()=>Promise<'granted'|'denied'>};
    const motion = window.DeviceMotionEvent as typeof DeviceMotionEvent & {requestPermission?:()=>Promise<'granted'|'denied'>};
    try {
      const requests = [orientation?.requestPermission?.(),motion?.requestPermission?.()].filter(Boolean) as Promise<string>[];
      if (requests.length) await Promise.all(requests);
    } catch { /* Резервное управление жестом остаётся доступным. */ }
    setOpened(true);
    navigator.vibrate?.([25,20,35]);
  }

  function playerPointerDown(event:React.PointerEvent<HTMLElement>) {
    if (pouring || result || shareCode) return;
    const bounds=event.currentTarget.getBoundingClientRect();
    screenGesture.current={x:event.clientX,y:event.clientY,upperHalf:event.clientY<bounds.top+bounds.height/2};
    setDragX(0);
    setDragging(false);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function playerPointerMove(event:React.PointerEvent<HTMLElement>) {
    const start=screenGesture.current;
    if (!start || opened || pouring || result || shareCode || inventory.length < 2) return;
    const dx=event.clientX-start.x;
    const dy=event.clientY-start.y;
    if (Math.abs(dx) < 4 || Math.abs(dx) <= Math.abs(dy)) return;
    const beyondStart=selectedIndex===0 && dx>0;
    const beyondEnd=selectedIndex===inventory.length-1 && dx<0;
    setDragging(true);
    setDragX((beyondStart||beyondEnd)?dx*.24:dx);
  }

  function playerPointerEnd(event:React.PointerEvent<HTMLElement>) {
    const start=screenGesture.current;
    screenGesture.current=null;
    setDragging(false);
    setDragX(0);
    if (!start || !activeItem || pouring || result || shareCode) return;
    const dx=event.clientX-start.x;
    const dy=event.clientY-start.y;
    const horizontal=Math.abs(dx)>Math.abs(dy);
    const threshold=Math.min(105,Math.max(58,event.currentTarget.clientWidth*.14));
    if (!opened && horizontal && Math.abs(dx)>threshold && inventory.length>1) {
      setSelectedIndex(current => dx<0 ? Math.min(current+1,inventory.length-1) : Math.max(current-1,0));
      navigator.vibrate?.(12);
      return;
    }
    if (start.upperHalf && !horizontal && dy < -42) {
      if (!opened) void openBottle(activeItem);
      else void consume();
    }
  }

  return <div className="site-shell">
    <header className="site-header">
      <button className="brand-button" onClick={() => setMode('master')}><span>✧</span><strong>Алхимический архив<small>ПРОТОТИП КАТАЛОГА ЗЕЛИЙ</small></strong></button>
      <nav aria-label="Режим просмотра">
        <button className={mode==='master'?'active':''} onClick={() => setMode('master')}>Каталог мастера</button>
        <button className={mode==='player'?'active':''} onClick={() => setMode('player')}>Инвентарь игрока <b>{inventory.length}</b></button>
      </nav>
    </header>

    {mode === 'master' ? <main className="master-layout">
      <section className="catalog-panel">
        <div className="page-title"><p>СОБРАНИЕ АЛХИМИЧЕСКИХ РЕЦЕПТОВ</p><h1>Каталог зелий</h1><span>Соберите набор для следующей игровой сессии, затем создайте персональные печати.</span></div>
        <div className="catalog-grid">
          {catalog.map((potion,index) => <article className="potion-card" key={potion.id} style={{'--potion-color':potion.color} as React.CSSProperties}>
            <div className="card-rarity"><span>{potion.rarity}</span><i>{'♥'.repeat(index+1)}</i></div>
            <div className="bottle-display"><div className="alchemy-ring">✦</div><Bottle level={index}/></div>
            <div className="card-copy"><p>ЗЕЛЬЕ ЛЕЧЕНИЯ</p><h2>{potion.name}</h2><div className="formula-row"><strong>{potion.formula}</strong><span>{potion.range} здоровья</span></div>
              <div className="quantity-control" aria-label={`Количество: ${potion.fullName}`}>
                <button onClick={() => changeQuantity(potion.id,-1)} disabled={!cart[potion.id]}>Убрать</button>
                <output>{cart[potion.id] || 0}</output>
                <button onClick={() => changeQuantity(potion.id,1)}>Добавить</button>
              </div>
            </div>
          </article>)}
        </div>
      </section>
      <aside className="cart-panel">
        <p className="kicker">ПОДГОТОВКА К СЕССИИ</p><h2>Корзина мастера</h2>
        {!total ? <div className="empty-cart"><span>☾</span><p>Добавьте зелья из каталога</p></div> : <ul>{catalog.filter(p => cart[p.id]).map(p => <li key={p.id}><span className="cart-swatch" style={{background:p.color}}/><div><strong>{p.name}</strong><small>{p.formula}</small></div><b>× {cart[p.id]}</b></li>)}</ul>}
        <div className="cart-total"><span>Всего бирок</span><strong>{total}</strong></div>
        <button className="primary-action" disabled={!total || busy} onClick={createPrintBatch}>{busy?'Создаём печати…':'Создать и печатать'}</button>
        <small className="prototype-note">В прототипе вход мастера не защищён. Перед публикацией добавим аккаунт и историю наборов.</small>
      </aside>
    </main> : <main className={`player-page ${opened?'opened':''} ${pouring?'pouring':''} ${dragging?'inventory-dragging':''}`} onPointerDown={playerPointerDown} onPointerMove={playerPointerMove} onPointerUp={playerPointerEnd} onPointerCancel={() => {screenGesture.current=null;setDragging(false);setDragX(0);}}>
      <div className="page-title player-title"><p>ЛИЧНАЯ СУМКА ПРИКЛЮЧЕНЦА</p><h1>Мои зелья</h1></div>
      <button className="inventory-scan-button" type="button" aria-label="Отсканировать новый QR-код" title="Отсканировать новый QR-код" onPointerDown={event => event.stopPropagation()} onClick={event => {event.stopPropagation();setScannerOpen(true);}}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4.5 10.3 3h3.4L15 4.5h3.2A2.8 2.8 0 0 1 21 7.3v10.4a2.8 2.8 0 0 1-2.8 2.8H5.8A2.8 2.8 0 0 1 3 17.7V7.3a2.8 2.8 0 0 1 2.8-2.8H9Zm3 3.2a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4Zm0 2a2.7 2.7 0 1 1 0 5.4 2.7 2.7 0 0 1 0-5.4Z"/></svg>
      </button>
      {!inventoryReady ? <div className="inventory-empty"><span>✦</span><h2>Проверяем печати…</h2></div> : !inventory.length ? <div className="inventory-empty"><span>☾</span><h2>Инвентарь пуст</h2><p>Отсканируйте бирку зелья обычной камерой телефона.</p></div> : <>
        <div className="inventory-stage" style={{'--drag-x':`${dragX}px`} as React.CSSProperties}>
          {inventory.map((item,index) => <article className={`inventory-card ${index===selectedIndex?'active':''}`} key={item.id} aria-hidden={index!==selectedIndex} style={{'--potion-color':item.potion.color,'--card-offset':index-selectedIndex,opacity:index===selectedIndex?1:.28} as React.CSSProperties}>
            <p>{item.potion.rarity} · ФЛАКОН {index+1} ИЗ {inventory.length}</p>
            <button className={`inventory-qr-toggle ${shareCode?.itemId===item.id?'active':''}`} disabled={opened || index!==selectedIndex} onClick={() => toggleShare(item)} aria-label={shareCode?.itemId===item.id?'Скрыть QR-код передачи':'Показать QR-код передачи'} title={shareCode?.itemId===item.id?'Скрыть QR-код':'Показать QR-код'}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h7v7H3V3Zm2 2v3h3V5H5Zm9-2h7v7h-7V3Zm2 2v3h3V5h-3ZM3 14h7v7H3v-7Zm2 2v3h3v-3H5Zm9-2h3v3h-3v-3Zm4 0h3v3h-3v-3Zm-4 4h3v3h-3v-3Zm4 0h1v1h2v2h-4v-3Z"/></svg>
            </button>
            <div className={`inventory-visual ${shareCode?.itemId===item.id?'showing-qr':''}`}>
              <div className="inventory-bottle-shell"><Bottle level={levelFor(catalog,item.potion)} fill={index===selectedIndex&&opened?1-liquidDrain:1} draining={pouring&&index===selectedIndex}/></div>
              {shareCode?.itemId===item.id && <div className="inventory-qr">
                <img src={shareCode.qr} alt={`QR-код передачи: ${item.potion.fullName}`}/>
                <strong>Передать зелье</strong><span>Пусть другой игрок отсканирует этот код</span>
              </div>}
            </div>
            <div className="inventory-copy"><h2>{item.potion.fullName}</h2><strong>{item.potion.formula}</strong><span>{item.potion.range} здоровья</span>{opened && index===selectedIndex && <div className="inventory-ritual-progress"><i style={{width:`${tilt*100}%`}}/></div>}</div>
          </article>)}
        </div>
      </>}
    </main>}

    {printOpen && <div className="print-overlay">
      <div className="print-toolbar"><div><strong>Печатный набор</strong><span>{printItems.length} отдельных бирок + общий QR</span></div><button onClick={() => setPrintOpen(false)}>Закрыть</button><button className="primary-action" onClick={() => window.print()}>Печатать</button></div>
      <div className="print-sheet">{printBundle && <BundleTag bundle={printBundle}/>} {printItems.map(item => <PrintTag item={item} key={item.id}/>)}</div>
    </div>}

    {sensorPrompt && mode==='player' && <div className="sensor-permission-overlay" role="dialog" aria-modal="true" aria-labelledby="sensor-title">
      <div className="sensor-permission-card">
        <span aria-hidden="true">✦</span>
        <p>ИНТЕРАКТИВНОЕ ЗЕЛЬЕ</p>
        <h2 id="sensor-title">Разрешить датчики движения?</h2>
        <div className="sensor-orbit" aria-hidden="true"><i>◒</i></div>
        <p className="sensor-copy">Это позволит наклонить телефон и выпить открытое зелье. Запрос появится только один раз на этом устройстве.</p>
        <button className="primary-action" disabled={sensorBusy} onClick={enableSensors}>{sensorBusy?'Запрашиваем доступ…':'Разрешить датчики'}</button>
        <button className="sensor-skip" disabled={sensorBusy} onClick={continueWithoutSensors}>Продолжить без датчиков</button>
      </div>
    </div>}

    {scannerOpen && <div className="scanner-overlay" role="dialog" aria-modal="true" aria-label="Сканер QR-кода">
      <div className="scanner-panel">
        <video ref={scannerVideo} autoPlay muted playsInline/>
        <div className="scanner-frame" aria-hidden="true"><i/><i/><i/><i/></div>
        {scannerStarting && <div className="scanner-loading">Открываем камеру…</div>}
        <button type="button" className="scanner-close" aria-label="Закрыть сканер" onClick={() => setScannerOpen(false)}>×</button>
      </div>
    </div>}

    {result && <div className="ritual-overlay"><div className="result-card" style={{'--potion-color':result.potion.color} as React.CSSProperties}>
        <p>ЗЕЛЬЕ ВЫПИТО</p><h1>Магия свершилась</h1><div className="result-amount">+{result.outcome.amount}<span>♥</span></div><small>ОЧКОВ ЗДОРОВЬЯ</small>
        <div className="result-dice">{result.outcome.dice.map((die,index)=><i key={index}>{die}</i>)}<b>+ {result.outcome.bonus}</b></div>
        <button className="primary-action" onClick={closeRitual}>Вернуться в инвентарь</button>
      </div></div>}

    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}
