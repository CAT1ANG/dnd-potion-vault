'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Bottle from './Bottle';

type Potion = {
  id:string; category:string; name:string; fullName:string; rarity:string;
  color:string; shape:string; interaction:string; range:string; formula:string;
};
type InventoryItem = {id:string; claimedAt:string; potion:Potion};
type PrintItem = {id:string; number:number; potion:Potion; url:string; qr:string};
type Outcome = {amount:number; dice:number[]; bonus:number; formula:string};

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

export default function PrototypeApp({catalog}:{catalog:Potion[]}) {
  const [mode,setMode] = useState<'master'|'player'>('master');
  const [cart,setCart] = useState<Record<string,number>>({});
  const [busy,setBusy] = useState(false);
  const [printItems,setPrintItems] = useState<PrintItem[]>([]);
  const [printOpen,setPrintOpen] = useState(false);
  const [deviceId,setDeviceId] = useState('');
  const [inventory,setInventory] = useState<InventoryItem[]>([]);
  const [inventoryReady,setInventoryReady] = useState(false);
  const [toast,setToast] = useState('');
  const [ritualItem,setRitualItem] = useState<InventoryItem|null>(null);
  const [opened,setOpened] = useState(false);
  const [pouring,setPouring] = useState(false);
  const [tilt,setTilt] = useState(0);
  const [result,setResult] = useState<{potion:Potion;outcome:Outcome}|null>(null);
  const previousIds = useRef<Set<string>>(new Set());
  const corkStart = useRef(0);
  const dragStart = useRef<{x:number;y:number}|null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const pouringRef = useRef(false);

  const total = useMemo(() => Object.values(cart).reduce((sum,value) => sum + value,0),[cart]);

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
    const token = new URLSearchParams(location.hash.slice(1)).get('p');
    const playerRequested = token || new URLSearchParams(location.search).has('player');
    if (playerRequested) setMode('player');
    if (token) {
      api<{transferred:boolean}>({action:'claim',token,deviceId:id})
        .then(data => {
          notify(data.transferred ? 'Зелье перешло в ваш инвентарь от другого игрока.' : 'Зелье добавлено в инвентарь.');
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
      const data = await api<{items:PrintItem[]}>({action:'create_batch',items});
      setPrintItems(data.items);
      setPrintOpen(true);
      notify(`Создано бирок: ${data.items.length}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Не удалось создать печатный набор');
    } finally { setBusy(false); }
  }

  const closeRitual = useCallback(async () => {
    setRitualItem(null); setOpened(false); setPouring(false); setTilt(0); setResult(null);
    pouringRef.current = false;
    await refreshInventory(deviceId,true);
  },[deviceId,refreshInventory]);

  const consume = useCallback(async () => {
    if (!ritualItem || pouringRef.current) return;
    pouringRef.current = true; setPouring(true); setTilt(1);
    try {
      const [data] = await Promise.all([
        api<{potion:Potion;outcome:Outcome}>({action:'consume',itemId:ritualItem.id,deviceId}),
        new Promise(resolve => window.setTimeout(resolve,1500)),
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
    function progress(value:number) {
      const normalized = Math.max(0,Math.min(1,(value-.08)/.82));
      setTilt(normalized);
      if (normalized > .86 && !holdTimer.current) holdTimer.current = setTimeout(consume,700);
      if (normalized <= .78 && holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current=null; }
    }
    function orientation(event:DeviceOrientationEvent) {
      if (event.beta == null || event.gamma == null) return;
      progress(Math.abs(Math.cos(event.beta*Math.PI/180)*Math.cos(event.gamma*Math.PI/180)));
    }
    function motion(event:DeviceMotionEvent) {
      const gravity = event.accelerationIncludingGravity;
      if (!gravity || gravity.x == null || gravity.y == null || gravity.z == null) return;
      const magnitude = Math.hypot(gravity.x,gravity.y,gravity.z);
      if (magnitude > 1) progress(Math.abs(gravity.z)/magnitude);
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

  async function openBottle() {
    if (opened) return;
    const orientation = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {requestPermission?:()=>Promise<'granted'|'denied'>};
    const motion = window.DeviceMotionEvent as typeof DeviceMotionEvent & {requestPermission?:()=>Promise<'granted'|'denied'>};
    try {
      const requests = [orientation?.requestPermission?.(),motion?.requestPermission?.()].filter(Boolean) as Promise<string>[];
      if (requests.length) await Promise.all(requests);
    } catch { /* Резервное управление жестом остаётся доступным. */ }
    setOpened(true);
    navigator.vibrate?.([25,20,35]);
  }

  function ritualPointerDown(event:React.PointerEvent) {
    if (!opened || pouring) return;
    dragStart.current={x:event.clientX,y:event.clientY};
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function ritualPointerMove(event:React.PointerEvent) {
    if (!dragStart.current || !opened || pouring) return;
    const distance = Math.hypot(event.clientX-dragStart.current.x,event.clientY-dragStart.current.y);
    const progress = Math.min(1,distance/150);
    setTilt(progress);
    if (progress > .92) consume();
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
    </main> : <main className="player-page">
      <div className="page-title player-title"><p>ЛИЧНАЯ СУМКА ПРИКЛЮЧЕНЦА</p><h1>Мои зелья</h1><span>Новый QR переносит флакон на это устройство. Проведите по коллекции, чтобы выбрать нужный.</span></div>
      {!inventoryReady ? <div className="inventory-empty"><span>✦</span><h2>Проверяем печати…</h2></div> : !inventory.length ? <div className="inventory-empty"><span>☾</span><h2>Инвентарь пуст</h2><p>Отсканируйте бирку зелья обычной камерой телефона.</p></div> : <>
        <div className="inventory-strip">
          {inventory.map((item,index) => <article className="inventory-card" key={item.id} style={{'--potion-color':item.potion.color} as React.CSSProperties}>
            <p>{item.potion.rarity} · ФЛАКОН {index+1} ИЗ {inventory.length}</p>
            <Bottle level={levelFor(catalog,item.potion)}/>
            <h2>{item.potion.fullName}</h2><strong>{item.potion.formula}</strong><span>{item.potion.range} здоровья</span>
            <button className="primary-action" onClick={() => {setRitualItem(item);setOpened(false);setTilt(0);}}>Выбрать этот флакон</button>
          </article>)}
        </div>
        <p className="swipe-hint">Листайте карточки горизонтальным свайпом</p>
      </>}
    </main>}

    {printOpen && <div className="print-overlay">
      <div className="print-toolbar"><div><strong>Печатный набор</strong><span>{printItems.length} уникальных бирок</span></div><button onClick={() => setPrintOpen(false)}>Закрыть</button><button className="primary-action" onClick={() => window.print()}>Печатать</button></div>
      <div className="print-sheet">{printItems.map(item => <PrintTag item={item} key={item.id}/>)}</div>
    </div>}

    {ritualItem && <div className={`ritual-overlay ${opened?'opened':''} ${pouring?'pouring':''}`}>
      {!result ? <div className="ritual-card" onPointerDown={ritualPointerDown} onPointerMove={ritualPointerMove} onPointerUp={() => {dragStart.current=null;}}>
        <button className="ritual-close" onClick={closeRitual}>Закрыть</button>
        <p>{ritualItem.potion.rarity}</p><h1>{ritualItem.potion.fullName}</h1>
        <div className="ritual-bottle" style={{transform:`rotate(${-tilt*76}deg)`}}><Bottle level={levelFor(catalog,ritualItem.potion)}/><button className="cork-gesture" aria-label="Смахнуть пробку вверх" onPointerDown={event => {corkStart.current=event.clientY;event.stopPropagation();}} onPointerUp={event => {event.stopPropagation();if(corkStart.current-event.clientY>35) openBottle();}}>СВАЙП</button></div>
        <div className="ritual-progress"><i style={{width:`${tilt*100}%`}}/></div>
        <h2>{!opened?'Смахните пробку вверх':pouring?'Зелье льётся…':'Наклоните телефон почти горизонтально'}</h2>
        <p className="ritual-help">После открытия можно также потянуть флакон пальцем — это резерв для устройств без датчика.</p>
      </div> : <div className="result-card" style={{'--potion-color':result.potion.color} as React.CSSProperties}>
        <p>ЗЕЛЬЕ ВЫПИТО</p><h1>Магия свершилась</h1><div className="result-amount">+{result.outcome.amount}<span>♥</span></div><small>ОЧКОВ ЗДОРОВЬЯ</small>
        <div className="result-dice">{result.outcome.dice.map((die,index)=><i key={index}>{die}</i>)}<b>+ {result.outcome.bonus}</b></div>
        <button className="primary-action" onClick={closeRitual}>Вернуться в инвентарь</button>
      </div>}
    </div>}

    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}
