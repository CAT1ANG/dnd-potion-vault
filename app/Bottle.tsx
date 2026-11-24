import {useId} from 'react';
const colors=['#ff6161','#d93f3f','#b52121','#8c0000'];
const shapes=[
 'M40 34 H76 V164 Q76 180 58 180 Q40 180 40 164 Z',
 'M45 34 H71 L110 166 Q113 180 99 180 H17 Q3 180 6 166 Z',
 'M25 37 H91 Q105 44 105 60 V166 Q105 180 91 180 H25 Q11 180 11 166 V60 Q11 44 25 37 Z',
 'M58 36 L112 93 L94 178 H22 L4 93 Z'
];
export default function Bottle({level=0,empty=false,fill=1,draining=false}:{level?:number,empty?:boolean,fill?:number,draining?:boolean}){
 const id=useId().replace(/:/g,'');const jar=level===2;const color=colors[level];const shape=shapes[level];
 const liquidOffset=(1-Math.max(0,Math.min(1,fill)))*112;
 return <div className={`bottle bottle-${level} ${empty?'empty':''}`} aria-hidden="true"><svg className="bottle-art" viewBox="0 0 116 190" fill="none"><defs>
 <clipPath id={`${id}-shape`}><path d={shape}/></clipPath>
 <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="116" y2="50" gradientUnits="userSpaceOnUse"><stop stopColor="#fffdf1" stopOpacity=".8"/><stop offset=".3" stopColor="#e4f2e5" stopOpacity=".12"/><stop offset=".72" stopColor="#b3c7b4" stopOpacity=".25"/><stop offset="1" stopColor="#fffdf6" stopOpacity=".9"/></linearGradient>
 <linearGradient id={`${id}-fluid`} x1="20" y1="80" x2="95" y2="190" gradientUnits="userSpaceOnUse"><stop stopColor={color}/><stop offset=".58" stopColor={color}/><stop offset="1" stopColor={color}/></linearGradient>
 <linearGradient id={`${id}-depth`} x1="25" y1="70" x2="110" y2="180" gradientUnits="userSpaceOnUse"><stop stopColor="white" stopOpacity=".22"/><stop offset=".4" stopColor="white" stopOpacity="0"/><stop offset="1" stopColor="#300000" stopOpacity=".35"/></linearGradient>
 <linearGradient id={`${id}-cork`}><stop stopColor="#916339"/><stop offset=".4" stopColor="#c29c68"/><stop offset="1" stopColor="#855a36"/></linearGradient></defs>
 <ellipse cx="58" cy="185" rx={level===0?23:44} ry="3" fill="#71502c" opacity=".16"/>
 <rect x={jar?25:42} y={jar?22:10} width={jar?66:32} height="25" rx="3" fill={`url(#${id}-cork)`} stroke="#89613e"/>
 {[0,1,2,3,4].map(i=><path key={i} d={`M${(jar?31:47)+i*(jar?12:5)} ${jar?25:13}v18`} stroke="#e4c291" opacity=".4"/>)}
 {level===3&&<rect x="43" y="30" width="30" height="29" rx="3" fill={`url(#${id}-glass)`} stroke="#fff9e9"/>}
 <path d={shape} fill={`url(#${id}-glass)`} stroke="#8e8b6d" strokeOpacity=".45" strokeWidth="2"/>
 <g clipPath={`url(#${id}-shape)`}>
 <g opacity={empty?.06:1} style={{transform:`translateY(${liquidOffset}px)`,transition:`transform ${draining?'1.5s linear':'.25s ease-out'}`}}><path d="M0 81 Q25 76 58 81 T116 81 V183 H0Z" fill={`url(#${id}-fluid)`}/><path d="M0 81 Q25 76 58 81 T116 81 V183 H0Z" fill={`url(#${id}-depth)`}/><path d="M0 81 Q25 76 58 81 T116 81" stroke="#ffc4b4" strokeWidth="2" opacity=".65"/>
 <circle cx="67" cy="94" r="2.4" stroke="#ffe5d1" opacity=".5"/><circle cx="47" cy="153" r="1.4" stroke="#ffe5d1" opacity=".5"/><circle cx="80" cy="161" r="2" stroke="#ffe5d1" opacity=".4"/></g>
 <path d={shape} fill="none" stroke="#fffdf0" strokeWidth="7" opacity=".4"/>
 <path d={level===0?'M46 46V161':level===1?'M44 58L15 163':level===2?'M24 56V160':'M51 52L17 96L29 158'} stroke="white" strokeWidth="5" strokeLinecap="round" opacity=".48"/>
 <path d={level===0?'M71 60V150':level===1?'M80 87L101 162':level===2?'M97 63V157':'M97 98L84 161'} stroke="white" strokeWidth="2" strokeLinecap="round" opacity=".55"/>
 </g><path d={shape} stroke="#fffcef" strokeWidth="1.1"/>
 <rect x={jar?22:level===0?36:39} y={jar?36:30} width={jar?72:level===0?44:38} height="9" rx="4" fill="#fffbe5" fillOpacity=".45" stroke="#fffced"/>
 </svg></div>
}
