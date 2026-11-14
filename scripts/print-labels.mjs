import QRCode from 'qrcode';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';

const base=(process.env.PUBLIC_SITE_URL||'https://cat1ang.github.io/dnd-potion-vault/').replace(/\/?$/,'/');
const rows=JSON.parse(readFileSync('outputs/potions.json'));
const names=['Обычное','Большое','Отличное','Превосходное'];
const formulas=['2к4 + 2','4к4 + 4','8к4 + 8','10к4 + 20'];
mkdirSync('outputs/qr',{recursive:true});

let cards='';
for(const row of rows){
  row.url=base+'#p='+row.token;
  const svg=await QRCode.toString(row.url,{type:'svg',errorCorrectionLevel:'M',margin:3,width:180});
  writeFileSync(`outputs/qr/${row.id}.svg`,svg);
  cards+=`<article class="t${row.type}"><div class="bottle"><div class="liquid"></div><div class="shine"></div><div class="qr">${svg}</div><div class="scratch">СТЕРЕТЬ ПЕЧАТЬ</div></div><h2>${names[row.type]}</h2><p>ЗЕЛЬЕ ЛЕЧЕНИЯ · ${formulas[row.type]}</p><small>№ ${row.id} · ОДНОРАЗОВОЕ</small></article>`;
}
writeFileSync('outputs/potions.json',JSON.stringify(rows,null,2));
writeFileSync('outputs/potions.csv','id,type,password,url\n'+rows.map(row=>`${row.id},${row.type},${row.token},${row.url}`).join('\n'));

writeFileSync('outputs/print-labels.html',`<!doctype html><html lang="ru"><meta charset="utf-8"><title>185 флаконов зелий</title><style>
@page{size:A4;margin:7mm}:root{--paper:#f2e3bf;--ink:#49372a}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Georgia}.instructions{padding:8mm}.instructions p{max-width:760px;line-height:1.5}main{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm}article{height:88mm;text-align:center;border:1px solid #9c7e59;background:linear-gradient(135deg,#fff9e3,#e6cfa1);break-inside:avoid;padding:3mm;overflow:hidden}.bottle{--c:#ff6161;position:relative;width:43mm;height:57mm;margin:auto;filter:drop-shadow(1mm 2mm 1mm #5a3b2422);background:linear-gradient(110deg,#fff9 0,#fff2 22%,#9aab9830 72%,#fff9),linear-gradient(to top,var(--c) 0 69%,transparent 69%);border:1px solid #87765f;clip-path:polygon(36% 0,64% 0,64% 15%,84% 26%,84% 100%,16% 100%,16% 26%,36% 15%)}.t1 .bottle{--c:#d93f3f;clip-path:polygon(38% 0,62% 0,62% 18%,95% 100%,5% 100%,38% 18%)}.t2 .bottle{--c:#b52121;clip-path:polygon(20% 0,80% 0,80% 12%,94% 23%,94% 100%,6% 100%,6% 23%,20% 12%)}.t3 .bottle{--c:#8c0000;clip-path:polygon(38% 0,62% 0,62% 14%,96% 43%,84% 100%,16% 100%,4% 43%,38% 14%)}.shine{position:absolute;left:7mm;top:13mm;width:2mm;height:33mm;background:#fff9;border-radius:50%}.qr{position:absolute;width:24mm;height:24mm;left:9.5mm;top:27mm;padding:1.2mm;background:white}.qr svg{display:block;width:100%;height:100%}.scratch{position:absolute;width:24mm;height:24mm;left:9.5mm;top:27mm;display:none;place-items:center;background:#aaa;color:#333;font:6px Arial;letter-spacing:.5px}.t0 .qr,.t0 .scratch{width:20mm;height:20mm;left:11.5mm;top:30mm}h2{font-size:17px;font-weight:400;margin:2mm 0 0}article p{font:8px Arial;letter-spacing:.5px;margin:1mm}small{font:7px Arial;color:#725b42}.cover-preview .scratch{display:grid}.cover-preview .qr{visibility:hidden}@media print{.instructions{display:none}main{gap:2mm}article{height:88mm}}
</style><div class="instructions"><h1>Алхимическая лавка · 185 флаконов</h1><p>Печатайте на плотной бумаге 200–300 г/м² с масштабом 100%. Наклейте стираемый стикер точно поверх белого QR-квадрата. Кнопка ниже показывает область покрытия только для проверки — перед печатью оставьте QR видимыми.</p><button onclick="document.querySelector('main').classList.toggle('cover-preview')">Показать область стираемого стикера</button> <button onclick="print()">Печатать</button></div><main>${cards}</main></html>`);
console.log('185 bottle labels, SVG QR codes and GitHub Pages links created');
