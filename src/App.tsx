'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import QRCode from 'qrcode';
import Bottle from './Bottle';

type Potion = {
  id:string; category:string; name:string; fullName:string; rarity:string;
  color:string; shape:string; interaction:string; range:string; formula:string;
  effect:'healing'|'resistance'|'duration'; effectLabel:string; benefit:string;
};
type InventoryItem = {id:string; claimedAt:string; potion:Potion};
type PrintItem = {id:string; number:number; potion:Potion; url:string; qr:string};
type PrintBundle = {url:string; qr:string; itemCount:number};
type Outcome = {kind:'healing'|'resistance'|'duration'; amount:number; dice:number[]; bonus:number; formula:string; damageType?:string; duration?:string; durationHours?:number};
type ShareCode = {itemId:string; url:string; qr:string};

const INVENTORY_KEY = 'dnd-potion-static-inventory-v1';

function levelFor(catalog:Potion[], potion:Potion) {
  const index = catalog.findIndex(item => item.id === potion.id);
  return index < 0 ? 0 : index;
}

function makeId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readInventory(catalog:Potion[]):InventoryItem[] {
  try {
    const ids=JSON.parse(localStorage.getItem(INVENTORY_KEY) || '[]') as string[];
    return ids.flatMap(id => {
      const potion=catalog.find(item => item.id===id);
      return potion ? [{id:makeId(),claimedAt:new Date().toISOString(),potion}] : [];
    });
  } catch { return []; }
}

function saveInventory(items:InventoryItem[]) {
  localStorage.setItem(INVENTORY_KEY,JSON.stringify(items.map(item => item.potion.id)));
}

function potionIdsFromUrl(rawValue:string) {
  const scanned=new URL(rawValue,location.href);
  const hash=new URLSearchParams(scanned.hash.slice(1));
  return (hash.get('potions') || '').split(',').filter(Boolean);
}

function potionUrl(ids:string[]) {
  return `${location.origin}${location.pathname}#potions=${encodeURIComponent(ids.join(','))}`;
}

const resistanceDamageTypes=['Звук','Излучение','Кислота','Некротическая энергия','Огонь','Психическая энергия','Силовое поле','Холод','Электричество','Яд'];

function potionEffectText(potion:Potion) {
  return potion.effect==='healing' ? `Восстанавливает ${potion.range} очков здоровья` : `${potion.benefit} на ${potion.range}`;
}

function potionRangeText(potion:Potion) {
  if (potion.effect==='healing') return `${potion.range} здоровья`;
  if (potion.effect==='resistance') return `Сопротивление на ${potion.range}`;
  return `Длительность: ${potion.range}`;
}

function hourLabel(hours:number) {
  return hours===1?'ЧАС':'ЧАСА';
}

function rarityMarks(rarity:string) {
  return '♥'.repeat(rarity==='Обычное'?1:rarity==='Необычное'?2:rarity==='Редкое'?3:4);
}

function rollPotion(potion:Potion):Outcome {
  if (potion.effect==='resistance') {
    const index=crypto.getRandomValues(new Uint8Array(1))[0]%resistanceDamageTypes.length;
    return {kind:'resistance',amount:0,dice:[],bonus:0,formula:potion.formula,damageType:resistanceDamageTypes[index],duration:potion.range};
  }
  if (potion.effect==='duration') {
    const hours=crypto.getRandomValues(new Uint8Array(1))[0]%4+1;
    return {kind:'duration',amount:hours,dice:[hours],bonus:0,formula:potion.formula,durationHours:hours};
  }
  const match=potion.formula.match(/(\d+)\D+(\d+)\s*\+\s*(\d+)/);
  const count=Number(match?.[1] || 1);
  const sides=Number(match?.[2] || 4);
  const bonus=Number(match?.[3] || 0);
  const bytes=crypto.getRandomValues(new Uint8Array(count));
  const dice=Array.from(bytes,value => value%sides+1);
  return {kind:'healing',amount:dice.reduce((sum,value) => sum+value,bonus),dice,bonus,formula:potion.formula};
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
      <strong>{item.potion.formula}</strong><span>{potionEffectText(item.potion)}</span>
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
      <p>ЕДИНАЯ ПЕЧАТЬ · ВЕСЬ НАБОР</p>
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
  const [inventory,setInventory] = useState<InventoryItem[]>([]);
  const [inventoryReady,setInventoryReady] = useState(false);
  const [selectedIndex,setSelectedIndex] = useState(0);
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
  const screenGesture = useRef<{x:number;y:number;upperHalf:boolean}|null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const sensorTilt = useRef(0);
  const scannerVideo = useRef<HTMLVideoElement|null>(null);
  const inventoryStage = useRef<HTMLDivElement|null>(null);
  const scannerHandled = useRef(false);
  const pouringRef = useRef(false);
  const sensorPermissionReady = useRef(false);

  const total = useMemo(() => Object.values(cart).reduce((sum,value) => sum + value,0),[cart]);
  const activeItem = inventory.length ? inventory[Math.min(selectedIndex,inventory.length-1)] : null;

  useEffect(() => {
    if (selectedIndex >= inventory.length) setSelectedIndex(Math.max(0,inventory.length-1));
  },[inventory.length,selectedIndex]);

  const notify = useCallback((message:string) => {
    setToast(message);
    window.setTimeout(() => setToast(current => current === message ? '' : current),3200);
  },[]);

  useEffect(() => {
    const stored=readInventory(catalog);
    const sensorChoice=localStorage.getItem('dnd-potion-sensors');
    const sensorCapable='DeviceOrientationEvent' in window || 'DeviceMotionEvent' in window;
    const orientation = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {requestPermission?:()=>Promise<'granted'|'denied'>};
    const motion = window.DeviceMotionEvent as typeof DeviceMotionEvent & {requestPermission?:()=>Promise<'granted'|'denied'>};
    const needsFreshPermission=typeof orientation?.requestPermission==='function' || typeof motion?.requestPermission==='function';
    // Safari может сбросить фактический доступ между загрузками, тогда как
    // сохранённое значение localStorage остаётся прежним. На iOS проверяем
    // разрешение заново при каждом новом открытии страницы.
    if (sensorCapable && window.matchMedia('(pointer: coarse)').matches && (!sensorChoice || needsFreshPermission)) setSensorPrompt(true);
    const hash = new URLSearchParams(location.hash.slice(1));
    const ids=(hash.get('potions') || '').split(',').filter(id => catalog.some(item => item.id===id));
    const playerRequested = ids.length || new URLSearchParams(location.search).has('player');
    if (playerRequested) setMode('player');
    const added=ids.flatMap(id => {
      const potion=catalog.find(item => item.id===id);
      return potion ? [{id:makeId(),claimedAt:new Date().toISOString(),potion}] : [];
    });
    const next=[...stored,...added];
    setInventory(next);
    saveInventory(next);
    setInventoryReady(true);
    if (added.length) {
      notify(added.length>1 ? `Набор из ${added.length} зелий добавлен в инвентарь.` : 'Зелье добавлено в инвентарь.');
      history.replaceState(null,'',`${location.pathname}?player=1`);
    }
  // Начальная привязка устройства выполняется один раз.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

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
      const selected=Object.entries(cart).flatMap(([potionId,quantity]) => Array.from({length:quantity},() => catalog.find(potion => potion.id===potionId))).filter((potion):potion is Potion => Boolean(potion));
      const items=await Promise.all(selected.map(async (potion,index) => {
        const url=potionUrl([potion.id]);
        return {id:makeId(),number:index+1,potion,url,qr:await QRCode.toDataURL(url,{errorCorrectionLevel:'M',margin:1,width:420,color:{dark:'#251a14',light:'#fffdf4'}})};
      }));
      const bundleUrl=potionUrl(selected.map(potion => potion.id));
      const bundle={url:bundleUrl,itemCount:selected.length,qr:await QRCode.toDataURL(bundleUrl,{errorCorrectionLevel:'M',margin:1,width:420,color:{dark:'#251a14',light:'#fffdf4'}})};
      setPrintItems(items);
      setPrintBundle(bundle);
      setPrintOpen(true);
      notify(`Создано бирок: ${items.length}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Не удалось создать печатный набор');
    } finally { setBusy(false); }
  }

  async function requestSensorPermissions() {
    const orientation = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {requestPermission?:()=>Promise<'granted'|'denied'>};
    const motion = window.DeviceMotionEvent as typeof DeviceMotionEvent & {requestPermission?:()=>Promise<'granted'|'denied'>};
    // Оба вызова создаём синхронно внутри пользовательского нажатия: после
    // первого await Safari уже может считать жест завершённым.
    const requests:Array<Promise<'granted'|'denied'>>=[];
    if (typeof orientation?.requestPermission==='function') requests.push(orientation.requestPermission());
    if (typeof motion?.requestPermission==='function') requests.push(motion.requestPermission());
    const results=requests.length ? await Promise.all(requests) : [];
    return !results.length || results.every(value => value==='granted');
  }

  async function enableSensors() {
    setSensorBusy(true);
    try {
      const granted=await requestSensorPermissions();
      sensorPermissionReady.current=granted;
      localStorage.setItem('dnd-potion-sensors',granted?'granted':'denied');
      setSensorPrompt(false);
      notify(granted?'Датчики движения включены.':'Доступ отклонён. Разрешите «Движение и ориентацию» в настройках Safari.');
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
      const url=potionUrl([item.potion.id]);
      const qr=await QRCode.toDataURL(url,{errorCorrectionLevel:'M',margin:1,width:420,color:{dark:'#251a14',light:'#fffdf4'}});
      setShareCode({itemId:item.id,url,qr});
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Не удалось создать QR-код передачи');
    }
  }

  const claimScannedCode = useCallback(async (rawValue:string) => {
    if (scannerHandled.current) return;
    scannerHandled.current=true;
    try {
      const ids=potionIdsFromUrl(rawValue);
      const added=ids.flatMap(id => {
        const potion=catalog.find(item => item.id===id);
        return potion ? [{id:makeId(),claimedAt:new Date().toISOString(),potion}] : [];
      });
      if (!added.length) throw new Error('В этом QR-коде нет зелья');
      setInventory(current => { const next=[...current,...added]; saveInventory(next); return next; });
      setScannerOpen(false);
      notify(added.length>1?`Набор из ${added.length} зелий добавлен в инвентарь.`:'Зелье добавлено в инвентарь.');
    } catch (error) {
      setScannerOpen(false);
      notify(error instanceof Error ? error.message : 'Не удалось прочитать QR-код');
    }
  },[catalog,notify]);

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

  const closeRitual = useCallback(() => {
    if (ritualItem) setInventory(current => {
      const next=current.filter(item => item.id!==ritualItem.id);
      saveInventory(next);
      return next;
    });
    setRitualItem(null); setOpened(false); setPouring(false); setTilt(0); setLiquidDrain(0); setResult(null);
    sensorTilt.current = 0;
    pouringRef.current = false;
  },[ritualItem]);

  const consume = useCallback(async () => {
    if (!ritualItem || pouringRef.current) return;
    pouringRef.current = true; setPouring(true); setTilt(1); setLiquidDrain(1);
    const consumed=ritualItem;
    const outcome=rollPotion(consumed.potion);
    window.setTimeout(() => setResult({potion:consumed.potion,outcome}),1500);
  },[ritualItem]);

  useEffect(() => {
    if (!opened || !ritualItem || result) return;
    let lastOrientationAt=0;
    let lastUpdateAt=performance.now();
    function progress(target:number) {
      const now=performance.now();
      const elapsed=Math.min(80,Math.max(8,now-lastUpdateAt));
      lastUpdateAt=now;
      // Сглаживаем только индикатор. Решение о начале питья принимается
      // по сырому углу, иначе фильтр добавляет почти секунду задержки.
      const smoothing=1-Math.pow(.82,elapsed/16.67);
      let next=sensorTilt.current+(target-sensorTilt.current)*smoothing;
      if (next < .025) next=0;
      sensorTilt.current=next;
      setTilt(current => Math.max(current,next));

      if (target > .94 && !holdTimer.current) holdTimer.current=setTimeout(consume,200);
      if (target <= .80 && holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current=null; }
    }
    function orientation(event:DeviceOrientationEvent) {
      if (event.gamma == null) return;
      lastOrientationAt=performance.now();
      // Фиксированная шкала: портретная вертикаль ≈ 0°, ребро ≈ ±90°.
      // Небольшая мёртвая зона не даёт обычному дрожанию запускать питьё.
      const degrees=Math.abs(event.gamma);
      progress(Math.max(0,Math.min(1,(degrees-10)/(82-10))));
    }
    function motion(event:DeviceMotionEvent) {
      const gravity = event.accelerationIncludingGravity;
      if (!gravity || gravity.x == null || gravity.y == null || gravity.z == null) return;
      // DeviceOrientation обычно стабильнее. Акселерометр используем только
      // как запасной вариант, если события ориентации перестали приходить.
      if (performance.now()-lastOrientationAt < 50) return;
      // При вертикальном телефоне X ≈ 0, на ребре X ≈ ±9.8 м/с².
      const sideGravity=Math.abs(gravity.x);
      progress(Math.max(0,Math.min(1,(sideGravity-1)/(9-1))));
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
    try {
      if (!sensorPermissionReady.current && localStorage.getItem('dnd-potion-sensors')!=='skipped') {
        const granted=await requestSensorPermissions();
        sensorPermissionReady.current=granted;
        if (!granted) {
          setSensorPrompt(true);
          notify('Сначала разрешите доступ к датчикам движения.');
          return;
        }
      }
    } catch {
      setSensorPrompt(true);
      notify('Safari не дал доступ к датчикам движения.');
      return;
    }
    setOpened(true);
    navigator.vibrate?.([25,20,35]);
  }

  function closeOpenedBottle() {
    if (!opened || pouring || result) return;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current=null;
    sensorTilt.current=0;
    setTilt(0);
    setLiquidDrain(0);
    setOpened(false);
    setRitualItem(null);
    navigator.vibrate?.(18);
  }

  function setCardDrag(value:number) {
    inventoryStage.current?.style.setProperty('--drag-x',`${value}px`);
  }

  function cancelCardDrag(page?:HTMLElement) {
    page?.classList.remove('inventory-dragging');
    setCardDrag(0);
  }

  function playerPointerDown(event:React.PointerEvent<HTMLElement>) {
    if (pouring || result || shareCode) return;
    const bounds=event.currentTarget.getBoundingClientRect();
    screenGesture.current={x:event.clientX,y:event.clientY,upperHalf:event.clientY<bounds.top+bounds.height/2};
    event.currentTarget.classList.remove('inventory-dragging');
    setCardDrag(0);
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
    event.currentTarget.classList.add('inventory-dragging');
    setCardDrag((beyondStart||beyondEnd)?dx*.24:dx);
  }

  function playerPointerEnd(event:React.PointerEvent<HTMLElement>) {
    const page=event.currentTarget;
    const start=screenGesture.current;
    screenGesture.current=null;
    if (!start || !activeItem || pouring || result || shareCode) {
      cancelCardDrag(page);
      return;
    }
    const dx=event.clientX-start.x;
    const dy=event.clientY-start.y;
    const horizontal=Math.abs(dx)>Math.abs(dy);
    const threshold=Math.min(105,Math.max(58,page.clientWidth*.14));
    const canMove=dx<0 ? selectedIndex<inventory.length-1 : selectedIndex>0;
    if (!opened && horizontal && Math.abs(dx)>threshold && inventory.length>1 && canMove) {
      const card=inventoryStage.current?.querySelector<HTMLElement>('.inventory-card.active');
      const step=(card?.getBoundingClientRect().width || page.clientWidth*.8)*1.04;
      // После смены индекса сохраняем карточки в точке отпускания пальца,
      // а затем одним CSS-переходом доводим соседнюю карточку до центра.
      setCardDrag(dx+(dx<0?step:-step));
      setSelectedIndex(current => dx<0 ? Math.min(current+1,inventory.length-1) : Math.max(current-1,0));
      requestAnimationFrame(() => {
        page.classList.remove('inventory-dragging');
        void inventoryStage.current?.offsetWidth;
        setCardDrag(0);
      });
      navigator.vibrate?.(12);
      return;
    }
    cancelCardDrag(page);
    if (opened && start.upperHalf && !horizontal && dy > 42) {
      closeOpenedBottle();
      return;
    }
    if (start.upperHalf && !horizontal && dy < -42) {
      if (!opened) void openBottle(activeItem);
      else void consume();
    }
  }

  return <div className={`site-shell ${mode==='player'&&opened?'potion-immersive':''}`}>
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
            <div className="card-rarity"><span>{potion.rarity}</span><i>{rarityMarks(potion.rarity)}</i></div>
            <div className="bottle-display"><div className="alchemy-ring">✦</div><Bottle level={index}/></div>
            <div className="card-copy"><p>{potion.effectLabel}</p><h2>{potion.name}</h2><div className="formula-row"><strong>{potion.formula}</strong><span>{potion.effect==='healing'?`${potion.range} здоровья`:potion.range}</span></div>
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
        <small className="prototype-note">QR-коды многоразовые. Инвентарь каждого игрока хранится только на его устройстве.</small>
      </aside>
    </main> : <main className={`player-page ${opened?'opened':''} ${pouring?'pouring':''}`} onPointerDown={playerPointerDown} onPointerMove={playerPointerMove} onPointerUp={playerPointerEnd} onPointerCancel={event => {screenGesture.current=null;cancelCardDrag(event.currentTarget);}}>
      <div className="page-title player-title"><p>ЛИЧНАЯ СУМКА ПРИКЛЮЧЕНЦА</p><h1>Мои зелья</h1></div>
      <button className="inventory-scan-button" type="button" aria-label="Отсканировать новый QR-код" title="Отсканировать новый QR-код" onPointerDown={event => event.stopPropagation()} onClick={event => {event.stopPropagation();setScannerOpen(true);}}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4.5 10.3 3h3.4L15 4.5h3.2A2.8 2.8 0 0 1 21 7.3v10.4a2.8 2.8 0 0 1-2.8 2.8H5.8A2.8 2.8 0 0 1 3 17.7V7.3a2.8 2.8 0 0 1 2.8-2.8H9Zm3 3.2a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4Zm0 2a2.7 2.7 0 1 1 0 5.4 2.7 2.7 0 0 1 0-5.4Z"/></svg>
      </button>
      {!inventoryReady ? <div className="inventory-empty"><span>✦</span><h2>Проверяем печати…</h2></div> : !inventory.length ? <div className="inventory-empty"><span>☾</span><h2>Инвентарь пуст</h2><p>Отсканируйте бирку зелья обычной камерой телефона.</p></div> : <>
        <div className="inventory-stage" ref={inventoryStage} style={{'--drag-x':'0px'} as React.CSSProperties}>
          {inventory.map((item,index) => <article className={`inventory-card ${index===selectedIndex?'active':''}`} key={item.id} aria-hidden={index!==selectedIndex} style={{'--potion-color':item.potion.color,'--card-offset':index-selectedIndex,opacity:index===selectedIndex?1:.28} as React.CSSProperties}>
            <p>{item.potion.rarity} · ФЛАКОН {index+1} ИЗ {inventory.length}</p>
            <button className={`inventory-qr-toggle ${shareCode?.itemId===item.id?'active':''}`} disabled={opened || index!==selectedIndex} onClick={() => toggleShare(item)} aria-label={shareCode?.itemId===item.id?'Скрыть QR-код передачи':'Показать QR-код передачи'} title={shareCode?.itemId===item.id?'Скрыть QR-код':'Показать QR-код'}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h7v7H3V3Zm2 2v3h3V5H5Zm9-2h7v7h-7V3Zm2 2v3h3V5h-3ZM3 14h7v7H3v-7Zm2 2v3h3v-3H5Zm9-2h3v3h-3v-3Zm4 0h3v3h-3v-3Zm-4 4h3v3h-3v-3Zm4 0h1v1h2v2h-4v-3Z"/></svg>
            </button>
            <div className={`inventory-visual ${shareCode?.itemId===item.id?'showing-qr':''}`}>
              <div className="inventory-bottle-shell"><Bottle level={levelFor(catalog,item.potion)} fill={index===selectedIndex&&opened?1-liquidDrain:1} draining={pouring&&index===selectedIndex}/></div>
              {shareCode?.itemId===item.id && <div className="inventory-qr">
                <img src={shareCode.qr} alt={`QR-код передачи: ${item.potion.fullName}`}/>
                <strong>Поделиться зельем</strong><span>Другой игрок получит копию этого флакона</span>
              </div>}
            </div>
            <div className="inventory-copy"><h2>{item.potion.fullName}</h2><strong>{item.potion.formula}</strong><span>{potionRangeText(item.potion)}</span>{opened && index===selectedIndex && <div className="inventory-ritual-progress"><i style={{width:`${tilt*100}%`}}/></div>}</div>
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

    {result && <div className="ritual-overlay"><div className={`result-card result-kind-${result.outcome.kind}`} style={{'--potion-color':result.potion.color} as React.CSSProperties}>
        <p>ЗЕЛЬЕ ВЫПИТО</p><h1>{result.outcome.kind==='healing'?'Магия свершилась':result.outcome.kind==='resistance'?'Сопротивление получено':result.potion.id==='growth'?'Вы увеличились':'Вы уменьшились'}</h1>
        {result.outcome.kind==='healing' ? <><div className="result-amount">+{result.outcome.amount}<span>♥</span></div><small>ОЧКОВ ЗДОРОВЬЯ</small>
        <div className="result-dice">{result.outcome.dice.map((die,index)=><i key={index}>{die}</i>)}<b>+ {result.outcome.bonus}</b></div></> : result.outcome.kind==='resistance' ? <><div className="result-damage-type">{result.outcome.damageType}</div><small>СОПРОТИВЛЕНИЕ К ЭТОМУ ВИДУ УРОНА</small><div className="result-duration"><span>◒</span><b>{result.outcome.duration}</b></div></> : <><div className="result-hours"><b>{result.outcome.durationHours}</b><span>{hourLabel(result.outcome.durationHours || 1)}</span></div><small>ДЛИТЕЛЬНОСТЬ ЭФФЕКТА</small><div className="result-duration"><span>◒</span><b>Результат броска 1к4</b></div></>}
        <button className="primary-action" onClick={closeRitual}>Вернуться в инвентарь</button>
      </div></div>}

    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}
