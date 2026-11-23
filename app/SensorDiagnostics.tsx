'use client';

import {useCallback,useEffect,useMemo,useRef,useState} from 'react';

type Reading={
  alpha:number|null; beta:number|null; gamma:number|null; absolute:boolean|null;
  gx:number|null; gy:number|null; gz:number|null; gravity:number|null;
  sideOrientation:number|null; sideGravity:number|null; flatGravity:number|null;
  screenAngle:number; interval:number|null; capturedAt:string;
};

type Snapshot={label:string;reading:Reading};

const emptyReading:Reading={alpha:null,beta:null,gamma:null,absolute:null,gx:null,gy:null,gz:null,gravity:null,sideOrientation:null,sideGravity:null,flatGravity:null,screenAngle:0,interval:null,capturedAt:''};
const number=(value:number|null,digits=2)=>value==null?'—':value.toFixed(digits);
const clamp=(value:number)=>Math.max(0,Math.min(1,value));

function average(history:Reading[],label:string):Snapshot|null {
  const sample=history.slice(-12);
  if (!sample.length) return null;
  const keys:(keyof Pick<Reading,'alpha'|'beta'|'gamma'|'gx'|'gy'|'gz'|'gravity'|'sideOrientation'|'sideGravity'|'flatGravity'|'interval'>)[]=['alpha','beta','gamma','gx','gy','gz','gravity','sideOrientation','sideGravity','flatGravity','interval'];
  const reading={...sample.at(-1)!};
  for (const key of keys) {
    const values=sample.map(item=>item[key]).filter((value):value is number=>typeof value==='number');
    reading[key]=values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
  }
  reading.capturedAt=new Date().toISOString();
  return {label,reading};
}

export default function SensorDiagnostics(){
  const [started,setStarted]=useState(false);
  const [permission,setPermission]=useState<'idle'|'asking'|'granted'|'denied'>('idle');
  const [reading,setReading]=useState<Reading>(emptyReading);
  const [vertical,setVertical]=useState<Snapshot|null>(null);
  const [edge,setEdge]=useState<Snapshot|null>(null);
  const [message,setMessage]=useState('');
  const live=useRef<Reading>({...emptyReading});
  const history=useRef<Reading[]>([]);

  const enable=useCallback(async()=>{
    setPermission('asking');
    try{
      const orientation=window.DeviceOrientationEvent as typeof DeviceOrientationEvent&{requestPermission?:()=>Promise<'granted'|'denied'>};
      const motion=window.DeviceMotionEvent as typeof DeviceMotionEvent&{requestPermission?:()=>Promise<'granted'|'denied'>};
      const requests=[orientation?.requestPermission?.(),motion?.requestPermission?.()].filter(Boolean) as Promise<string>[];
      const results=requests.length?await Promise.all(requests):['granted'];
      if(results.some(result=>result!=='granted')) throw new Error('denied');
      setPermission('granted');setStarted(true);
    }catch{setPermission('denied');setMessage('Доступ отклонён. Разрешите датчики движения в настройках браузера и перезагрузите страницу.');}
  },[]);

  useEffect(()=>{
    if(!started)return;
    function orientation(event:DeviceOrientationEvent){
      const gamma=event.gamma;
      live.current={...live.current,alpha:event.alpha,beta:event.beta,gamma,absolute:event.absolute,sideOrientation:gamma==null?null:Math.abs(Math.sin(gamma*Math.PI/180)),screenAngle:screen.orientation?.angle??Number((window as Window&{orientation?:number}).orientation??0),capturedAt:new Date().toISOString()};
    }
    function motion(event:DeviceMotionEvent){
      const gravity=event.accelerationIncludingGravity;
      if(!gravity)return;
      const gx=gravity.x,gy=gravity.y,gz=gravity.z;
      const magnitude=gx==null||gy==null||gz==null?null:Math.hypot(gx,gy,gz);
      live.current={...live.current,gx,gy,gz,gravity:magnitude,sideGravity:magnitude&&gx!=null?Math.abs(gx)/magnitude:null,flatGravity:magnitude&&gz!=null?Math.abs(gz)/magnitude:null,interval:event.interval,capturedAt:new Date().toISOString()};
    }
    window.addEventListener('deviceorientation',orientation,{passive:true});
    window.addEventListener('devicemotion',motion,{passive:true});
    const timer=window.setInterval(()=>{
      const next={...live.current};
      history.current=[...history.current.slice(-119),next];
      setReading(next);
    },100);
    return()=>{window.removeEventListener('deviceorientation',orientation);window.removeEventListener('devicemotion',motion);window.clearInterval(timer);};
  },[started]);

  const delta=useMemo(()=>{
    if(!vertical||!edge)return null;
    const axes=['beta','gamma','gx','gy','gz'] as const;
    const values=axes.map(axis=>{
      const raw=(edge.reading[axis]??0)-(vertical.reading[axis]??0);
      const value=axis==='beta'||axis==='gamma'?((raw+540)%360)-180:raw;
      return {axis,value};
    });
    return values.sort((a,b)=>Math.abs(b.value)-Math.abs(a.value));
  },[vertical,edge]);

  const report=useMemo(()=>JSON.stringify({
    generatedAt:new Date().toISOString(),userAgent:typeof navigator==='undefined'?'':navigator.userAgent,
    screen:{width:typeof screen==='undefined'?0:screen.width,height:typeof screen==='undefined'?0:screen.height,pixelRatio:typeof devicePixelRatio==='undefined'?0:devicePixelRatio,orientation:reading.screenAngle},
    live:reading,vertical,edge,axisDelta:delta,
  },null,2),[reading,vertical,edge,delta]);

  async function copyReport(){
    try{await navigator.clipboard.writeText(report);setMessage('Отчёт скопирован. Пришли его мне сообщением.');}
    catch{setMessage('Не получилось скопировать автоматически. Сделай скриншоты двух зафиксированных состояний.');}
  }

  function capture(label:'Вертикально'|'На ребре'){
    const snapshot=average(history.current,label);
    if(!snapshot){setMessage('Подожди секунду, пока появятся показания.');return;}
    if(label==='Вертикально')setVertical(snapshot);else setEdge(snapshot);
    setMessage(`${label}: усреднили последние 12 показаний.`);
  }

  const orientationProgress=clamp(reading.sideOrientation??0);
  const gravityProgress=clamp(reading.sideGravity??0);

  return <main className="sensor-test-page">
    <section className="sensor-test-header"><p>АЛХИМИЧЕСКАЯ ЛАБОРАТОРИЯ · ДИАГНОСТИКА</p><h1>Калибровка движения</h1><span>Сначала держи телефон обычным вертикальным экраном к себе. Затем поверни его на то ребро, которым ты хочешь «выпивать» зелье.</span></section>

    {!started?<section className="sensor-start-card"><div className="sensor-phone-icon">◫</div><h2>Включить живые показания</h2><p>Страница ничего не записывает на сервер. Все значения остаются на этом устройстве, пока ты не скопируешь отчёт.</p><button className="primary-action" disabled={permission==='asking'} onClick={enable}>{permission==='asking'?'Запрашиваем доступ…':'Разрешить датчики'}</button>{permission==='denied'&&<strong>Доступ к датчикам не получен</strong>}</section>:<>
      <section className="sensor-live-card">
        <div className="sensor-live-title"><div><p>ЖИВЫЕ ДАННЫЕ · 10 РАЗ В СЕКУНДУ</p><h2>Что видит браузер</h2></div><span className="sensor-live-dot">LIVE</span></div>
        <div className="sensor-axis-grid">
          <div><small>ALPHA</small><strong>{number(reading.alpha,1)}°</strong><span>поворот вокруг вертикали</span></div>
          <div><small>BETA</small><strong>{number(reading.beta,1)}°</strong><span>наклон вперёд / назад</span></div>
          <div><small>GAMMA</small><strong>{number(reading.gamma,1)}°</strong><span>боковой крен</span></div>
          <div><small>ЭКРАН</small><strong>{reading.screenAngle}°</strong><span>ориентация интерфейса</span></div>
        </div>
        <div className="sensor-gravity-grid">
          <div><small>GRAVITY X</small><strong>{number(reading.gx)}</strong></div><div><small>GRAVITY Y</small><strong>{number(reading.gy)}</strong></div><div><small>GRAVITY Z</small><strong>{number(reading.gz)}</strong></div><div><small>|G|</small><strong>{number(reading.gravity)}</strong></div>
        </div>
        <div className="sensor-bars">
          <label><span>Боковой крен по gamma <b>{Math.round(orientationProgress*100)}%</b></span><i><em style={{width:`${orientationProgress*100}%`}}/></i></label>
          <label><span>Боковой крен по gravity.x <b>{Math.round(gravityProgress*100)}%</b></span><i><em style={{width:`${gravityProgress*100}%`}}/></i></label>
          <label><span>Телефон лежит плашмя <b>{Math.round(clamp(reading.flatGravity??0)*100)}%</b></span><i><em style={{width:`${clamp(reading.flatGravity??0)*100}%`}}/></i></label>
        </div>
      </section>

      <section className="sensor-capture-grid">
        <button className={vertical?'captured':''} onClick={()=>capture('Вертикально')}><small>ШАГ 1</small><strong>{vertical?'Вертикаль записана':'Запомнить вертикаль'}</strong><span>{vertical?`β ${number(vertical.reading.beta,1)}° · γ ${number(vertical.reading.gamma,1)}°`:'Держи телефон прямо перед собой'}</span></button>
        <button className={edge?'captured':''} onClick={()=>capture('На ребре')}><small>ШАГ 2</small><strong>{edge?'Ребро записано':'Запомнить положение на ребре'}</strong><span>{edge?`β ${number(edge.reading.beta,1)}° · γ ${number(edge.reading.gamma,1)}°`:'Поверни телефон как при выпивании'}</span></button>
      </section>

      {delta&&<section className="sensor-result-card"><p>ПРЕДВАРИТЕЛЬНЫЙ ВЫВОД</p><h2>Положение на ребре <b>записано</b></h2><div>{delta.map(item=><span key={item.axis}>{item.axis}: <strong>{item.value>0?'+':''}{number(item.value)}</strong></span>)}</div><button className="primary-action" onClick={copyReport}>Скопировать отчёт</button></section>}
    </>}
    {message&&<div className="sensor-test-message" role="status">{message}</div>}
  </main>;
}
