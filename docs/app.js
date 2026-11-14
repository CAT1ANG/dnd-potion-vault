const API = 'https://potion-vault-dnd-141126.opensky137.chatgpt.site/api/drink';
const TOKEN_PATTERN = /^[a-f0-9]{48}$/;
const SHAPES = {
  vial: 'M82 58H138V300Q138 330 110 330Q82 330 82 300Z',
  flask: 'M86 58H134L196 300Q202 330 176 330H44Q18 330 24 300Z',
  jar: 'M48 64H172Q192 74 192 103V302Q192 330 166 330H54Q28 330 28 302V103Q28 74 48 64Z',
  pentagon: 'M110 62L204 168L172 330H48L16 168Z',
};
const CATALOG = [
  {id:'healing-common',name:'Обычное',fullName:'Обычное зелье лечения',rarity:'Обычное',color:'#ff6161',shape:'vial',formula:'2к4 + 2',range:'4–10'},
  {id:'healing-greater',name:'Большое',fullName:'Большое зелье лечения',rarity:'Необычное',color:'#d93f3f',shape:'flask',formula:'4к4 + 4',range:'8–20'},
  {id:'healing-superior',name:'Отличное',fullName:'Отличное зелье лечения',rarity:'Редкое',color:'#b52121',shape:'jar',formula:'8к4 + 8',range:'16–40'},
  {id:'healing-supreme',name:'Превосходное',fullName:'Превосходное зелье лечения',rarity:'Очень редкое',color:'#8c0000',shape:'pentagon',formula:'10к4 + 20',range:'30–60'},
];

const $ = selector => document.querySelector(selector);
const views = ['loadingView','landingView','ritualView','resultView','errorView'];
const state = {token:null,potion:null,type:0,demo:false,opened:false,pouring:false,sound:true,motion:false,base:null,holdTimer:null,drag:null};
let bottleSequence = 0;
let audioContext;

function showView(id) {
  views.forEach(view => document.getElementById(view).hidden = view !== id);
  $('#app').dataset.state = id.replace('View','');
  window.scrollTo({top:0,behavior:'smooth'});
}

function bottleSvg(potion, options = {}) {
  const id = `potion-${++bottleSequence}`;
  const shape = SHAPES[potion.shape] || SHAPES.jar;
  const jar = potion.shape === 'jar';
  const empty = options.empty ? 1 : 0;
  const bubbles = '<circle cx="130" cy="185" r="4"/><circle cx="83" cy="258" r="2.5"/><circle cx="147" cy="275" r="3"/>';
  return `<div class="bottle-mount ${options.mini ? 'mini-bottle' : ''}" style="--accent:${potion.color}">
    <svg class="bottle-svg" viewBox="0 0 220 350" role="img" aria-label="${potion.fullName}">
      <defs>
        <clipPath id="${id}-clip"><path d="${shape}"/></clipPath>
        <linearGradient id="${id}-glass" x1="0" y1="0" x2="220" y2="80"><stop stop-color="#fffef1" stop-opacity=".82"/><stop offset=".3" stop-color="#e4f2e5" stop-opacity=".12"/><stop offset=".72" stop-color="#aebfae" stop-opacity=".24"/><stop offset="1" stop-color="#fffdf6" stop-opacity=".9"/></linearGradient>
        <linearGradient id="${id}-liquid" x1="45" y1="140" x2="180" y2="330"><stop stop-color="${potion.color}"/><stop offset=".65" stop-color="${potion.color}"/><stop offset="1" stop-color="#47000d"/></linearGradient>
        <linearGradient id="${id}-cork" x1="0" x2="1"><stop stop-color="#805331"/><stop offset=".45" stop-color="#c29b68"/><stop offset="1" stop-color="#79502f"/></linearGradient>
      </defs>
      <ellipse cx="110" cy="339" rx="70" ry="7" fill="#634326" opacity=".15"/>
      <g class="bottle-cork"><rect x="${jar ? 55 : 82}" y="${jar ? 18 : 10}" width="${jar ? 110 : 56}" height="48" rx="5" fill="url(#${id}-cork)" stroke="#755039"/><path d="M${jar ? 65 : 91} 22v37m18-37v37m18-37v37m18-37v37m18-37v37" stroke="#ebc894" opacity=".34"/></g>
      ${potion.shape === 'pentagon' ? `<rect x="82" y="51" width="56" height="48" rx="5" fill="url(#${id}-glass)" stroke="#fffbed"/>` : ''}
      <path d="${shape}" fill="url(#${id}-glass)" stroke="rgba(72,64,49,.34)" stroke-width="3"/>
      <g clip-path="url(#${id}-clip)">
        <g class="liquid-shape" style="opacity:${1-empty}">
          <path d="M0 150Q55 140 110 150T220 150V350H0Z" fill="url(#${id}-liquid)"/>
          <path class="liquid-surface" d="M0 150Q55 140 110 150T220 150" fill="none" stroke="#ffd0c3" stroke-width="4" opacity=".62"/>
          <g fill="none" stroke="#ffe2d7" opacity=".52">${bubbles}</g>
        </g>
        <path d="${shape}" fill="none" stroke="#fffdf0" stroke-width="12" opacity=".28"/>
        <path class="glass-highlight" d="${potion.shape === 'vial' ? 'M94 82V292' : potion.shape === 'flask' ? 'M84 100L39 293' : potion.shape === 'jar' ? 'M52 104V292' : 'M91 104L40 173L59 286'}"/>
        <path d="${potion.shape === 'vial' ? 'M128 104V270' : potion.shape === 'flask' ? 'M148 141L183 292' : potion.shape === 'jar' ? 'M173 112V282' : 'M178 177L158 290'}" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" opacity=".55"/>
      </g>
      <path class="bottle-outline" d="${shape}"/>
      <rect x="${jar ? 49 : potion.shape === 'vial' ? 75 : 77}" y="${jar ? 57 : 53}" width="${jar ? 122 : potion.shape === 'vial' ? 70 : 66}" height="14" rx="7" fill="#fffbea" fill-opacity=".42" stroke="#fffced"/>
    </svg>
  </div>`;
}

function renderLanding() {
  $('#landingBottles').innerHTML = CATALOG.map(potion => `<article class="catalog-card">${bottleSvg(potion,{mini:true})}<h2>${potion.name}</h2><p>${potion.formula} · ${potion.range} здоровья</p></article>`).join('');
  showView('landingView');
}

async function api(action) {
  const response = await fetch(API, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:state.token,action})});
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Лавка временно не отвечает');
  return body;
}

async function inspectPotion() {
  showView('loadingView');
  try {
    const data = await api('inspect');
    state.potion = data.potion;
    state.type = data.type;
    state.demo = Boolean(data.demo);
    document.documentElement.style.setProperty('--accent', state.potion.color);
    if (data.status === 'consumed') renderResult(data, true);
    else renderRitual();
  } catch (error) {
    renderError(error.message);
  }
}

function renderRitual() {
  resetInteraction();
  $('#potionRarity').textContent = `${state.potion.rarity} · ${state.demo ? 'печать мастера' : 'одноразовая печать'}`;
  $('#potionTitle').textContent = state.potion.fullName;
  $('#potionFormula').textContent = `${state.potion.formula} · ${state.potion.range} здоровья`;
  $('#bottleMount').innerHTML = bottleSvg(state.potion);
  $('#stageCaption').textContent = 'Смахните пробку вверх';
  $('#sensorMessage').textContent = 'На компьютере бутылку можно потянуть вверх пальцем или мышью.';
  showView('ritualView');
  bindInteraction();
}

function resetInteraction() {
  state.opened = false; state.pouring = false; state.motion = false; state.base = null; state.drag = null;
  clearTimeout(state.holdTimer); state.holdTimer = null;
  window.removeEventListener('deviceorientation', onOrientation);
  $('#stage').className = 'potion-stage';
  $('#stage').style.removeProperty('--tilt');
  $('#tiltMeter').style.removeProperty('--tilt-progress');
  [...$('#steps').children].forEach((item,index) => item.className = index === 0 ? 'active' : '');
}

function bindInteraction() {
  const cork = $('#corkHandle');
  let startY = 0;
  cork.onpointerdown = event => { startY = event.clientY; cork.setPointerCapture?.(event.pointerId); };
  cork.onpointerup = event => { if (!state.opened && startY - event.clientY > 42) openBottle(); };
  cork.onclick = () => { if (!state.opened) openBottle(); };
  cork.onkeydown = event => { if ((event.key === 'Enter' || event.key === ' ') && !state.opened) { event.preventDefault(); openBottle(); } };
  const stage = $('#stage');
  stage.onpointerdown = event => {
    if (!state.opened || state.pouring || event.target.closest('#corkHandle')) return;
    state.drag = {id:event.pointerId,x:event.clientX,y:event.clientY};
    stage.setPointerCapture?.(event.pointerId); stage.classList.add('dragging');
  };
  stage.onpointermove = event => {
    if (!state.drag || state.drag.id !== event.pointerId || state.pouring) return;
    const distance = Math.hypot(event.clientX-state.drag.x,event.clientY-state.drag.y);
    const progress = Math.min(1,distance/150);
    stage.style.setProperty('--tilt',`${-progress*76}deg`);
    $('#tiltMeter').style.setProperty('--tilt-progress',progress);
    if (progress >= .92) beginPour();
  };
  stage.onpointerup = stage.onpointercancel = () => { state.drag=null;stage.classList.remove('dragging');if(!state.pouring)stage.style.setProperty('--tilt','0deg'); };
}

function setStep(index) {
  [...$('#steps').children].forEach((item,i) => item.className = i < index ? 'done' : i === index ? 'active' : '');
}

function requestMotionPermission() {
  const Orientation = window.DeviceOrientationEvent;
  if (!Orientation) return Promise.resolve(false);
  if (typeof Orientation.requestPermission === 'function') return Orientation.requestPermission().then(value => value === 'granted').catch(() => false);
  return Promise.resolve(true);
}

async function openBottle() {
  if (state.opened) return;
  state.opened = true;
  const permission = requestMotionPermission();
  document.documentElement.requestFullscreen?.({navigationUI:'hide'}).catch(() => {});
  $('#stage').classList.add('uncorked');
  $('#stageCaption').textContent = 'Теперь наклоните телефон почти горизонтально';
  setStep(1); playPop(); navigator.vibrate?.([25,20,35]);
  state.motion = await permission;
  if (state.motion) {
    window.addEventListener('deviceorientation', onOrientation, {passive:true});
    $('#stage').classList.add('motion-ready');
    $('#sensorMessage').textContent = 'Датчики движения включены. Наклоните телефон, словно пьёте из флакона.';
  } else {
    $('#sensorMessage').textContent = 'Датчик движения недоступен. Потяните бутылку вверх или в сторону пальцем.';
  }
}

function angularDistance(a,b) {
  if (a == null || b == null) return 0;
  return Math.abs(((a-b+180)%360+360)%360-180);
}

function onOrientation(event) {
  if (!state.opened || state.pouring) return;
  if (!state.base) { state.base={beta:event.beta,gamma:event.gamma}; return; }
  const delta = Math.max(angularDistance(event.beta,state.base.beta),angularDistance(event.gamma,state.base.gamma));
  const progress = Math.max(0,Math.min(1,(delta-8)/58));
  $('#stage').style.setProperty('--tilt',`${-progress*76}deg`);
  $('#tiltMeter').style.setProperty('--tilt-progress',progress);
  if (progress > .86 && !state.holdTimer) state.holdTimer = setTimeout(beginPour,700);
  if (progress <= .78 && state.holdTimer) { clearTimeout(state.holdTimer);state.holdTimer=null; }
}

async function beginPour() {
  if (state.pouring) return;
  state.pouring = true; clearTimeout(state.holdTimer); state.holdTimer=null;
  window.removeEventListener('deviceorientation', onOrientation);
  $('#stage').classList.add('pouring'); $('#stage').classList.remove('dragging');
  $('#stageCaption').textContent = 'Зелье льётся…'; setStep(2); playPour(); navigator.vibrate?.([35,60,35]);
  try {
    const [data] = await Promise.all([api('consume'),new Promise(resolve => setTimeout(resolve,1750))]);
    renderResult(data, Boolean(data.used));
  } catch (error) {
    renderError(error.message,'Магия прервалась');
  }
}

function renderResult(data, replayed) {
  state.potion = data.potion || state.potion;
  const outcome = data.outcome || {};
  $('#resultEyebrow').textContent = data.demo ? 'БЕСКОНЕЧНАЯ ПЕЧАТЬ МАСТЕРА' : replayed ? 'СОХРАНЁННЫЙ РЕЗУЛЬТАТ' : 'ЗЕЛЬЕ ВЫПИТО';
  $('#resultHeading').textContent = replayed && !data.demo ? 'Магия уже свершилась.' : 'Жизнь возвращается.';
  $('#resultPotion').textContent = state.potion.fullName;
  $('#healAmount').textContent = outcome.amount ?? 0;
  $('#emptyBottleMount').innerHTML = bottleSvg(state.potion,{empty:true});
  const dice = Array.isArray(outcome.dice) ? outcome.dice : [];
  $('#dice').innerHTML = dice.map(value => `<span>${value}</span>`).join('') + `<b>+ ${outcome.bonus ?? 0}</b>`;
  $('#resultNote').textContent = data.demo ? 'Тест мастера · Игровой запас не расходуется' : `${replayed ? 'Результат восстановлен' : 'Печать погашена'} · Новый бросок невозможен`;
  $('#againButton').hidden = !data.demo;
  showView('resultView'); playResult();
}

function renderError(message,heading='Печать не открылась') {
  $('#errorHeading').textContent = heading;
  $('#errorText').textContent = message;
  showView('errorView');
}

function audio() {
  if (!state.sound) return null;
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  audioContext.resume?.(); return audioContext;
}

function tone(frequency,duration,type='sine',volume=.08,delay=0) {
  const context=audio(); if(!context)return;
  const oscillator=context.createOscillator(),gain=context.createGain();
  oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,context.currentTime+delay);
  gain.gain.setValueAtTime(volume,context.currentTime+delay);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+delay+duration);
  oscillator.connect(gain).connect(context.destination);oscillator.start(context.currentTime+delay);oscillator.stop(context.currentTime+delay+duration);
}
function playPop(){tone(170,.12,'triangle',.11);tone(520,.16,'sine',.05,.07)}
function playPour(){[0,1,2,3].forEach(i=>tone(210+i*26,.45,'sine',.025,i*.17))}
function playResult(){tone(523,.7,'sine',.06);tone(659,.7,'sine',.045,.12);tone(784,.8,'sine',.04,.24)}

function resetDemo() { renderRitual(); }

async function boot() {
  state.token = new URLSearchParams(location.hash.slice(1)).get('p');
  $('#soundToggle').onclick = () => {
    state.sound=!state.sound;$('#soundToggle').setAttribute('aria-pressed',String(state.sound));$('#soundToggle').setAttribute('aria-label',state.sound?'Выключить звук':'Включить звук');
  };
  $('#retryButton').onclick = inspectPotion;
  $('#againButton').onclick = resetDemo;
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  if (!state.token) return renderLanding();
  if (!TOKEN_PATTERN.test(state.token)) return renderError('QR-код повреждён или ссылка была скопирована не полностью.');
  await inspectPotion();
}

boot();
