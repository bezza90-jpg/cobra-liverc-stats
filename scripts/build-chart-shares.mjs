import { addSiteShell } from './site-shell.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const {createCanvas}=await import(process.env.COBRA_CANVAS_MODULE || '@napi-rs/canvas');
const root=fileURLToPath(new URL('../public/',import.meta.url)),out=path.join(root,'lap-charts/share');
const base='https://bezza90-jpg.github.io/cobra-liverc-stats/lap-charts/share/';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cv=createCanvas(1200,630),ctx=cv.getContext('2d');
const colors=['#a3f329','#ffffff','#08cc48','#91bfa0','#d5edbb','#52dfbb','#c3c9c5','#5bb377','#e2f883','#68a995'];
function text(value,x,y,size,color='#ffffff'){ctx.fillStyle=color;ctx.font=`bold ${size}px Arial`;let s=String(value);while(ctx.measureText(s).width>1100&&s.length>1)s=s.slice(0,-2)+'…';ctx.fillText(s,x,y);}
function preview(race,driver){
 ctx.fillStyle='#090f0b';ctx.fillRect(0,0,1200,630);const gradient=ctx.createLinearGradient(0,0,1200,0);gradient.addColorStop(0,'#040b07');gradient.addColorStop(1,'#087b1a');ctx.fillStyle=gradient;ctx.fillRect(0,0,1200,145);
 text('COBRA / '+(driver?'DRIVER LAP TIMES':'RACE POSITIONS'),40,40,24,'#a3f329');text(driver?.name||race.name,40,87,32);text(race.date+' · '+(driver?race.name:race.event),40,121,18);
 const drivers=driver?[driver]:race.drivers, laps=drivers.flatMap(d=>d.laps.filter(l=>l.seconds>0&&Number.isFinite(l.seconds))),last=Math.max(2,...laps.map(l=>l.lap));
 const lo=driver?Math.max(0,Math.floor(Math.min(...laps.map(l=>l.seconds))-1)):1,hi=driver?Math.ceil(Math.max(...laps.map(l=>l.seconds))+1):Math.max(2,drivers.length,...laps.map(l=>l.position||1));
 const x=l=>85+(l-1)/(last-1)*1050,y=v=>driver?450-(v-lo)/(hi-lo)*270:180+(v-lo)/(hi-lo)*270;
 for(let i=0;i<5;i++){const v=lo+(hi-lo)*i/4;ctx.strokeStyle='#294033';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(85,y(v));ctx.lineTo(1135,y(v));ctx.stroke();text(driver?v.toFixed(1)+'s':'P'+Math.round(v),15,y(v)+5,15,'#c6d9cc');}
 for(let l=1;l<=last;l++){if(l!==1&&l!==last&&l%Math.max(1,Math.ceil(last/18)))continue;text(l,x(l)-5,478,14,'#c6d9cc');}text('LAP',570,504,15,'#c6d9cc');
 drivers.forEach((d,i)=>{ctx.strokeStyle=colors[i%colors.length];ctx.lineWidth=3;ctx.setLineDash(i%2?[8,4]:[]);ctx.beginPath();let previous=0;for(const l of d.laps){const v=driver?l.seconds:l.position;if(!Number.isFinite(v)||v<=0)continue;if(l.lap!==previous+1||!previous)ctx.moveTo(x(l.lap),y(v));else ctx.lineTo(x(l.lap),y(v));previous=l.lap;}ctx.stroke();ctx.setLineDash([]);if(!driver&&i<12){const col=i%3,row=Math.floor(i/3);text(d.name.slice(0,28),40+col*385,535+row*20,13,colors[i%colors.length]);}});
 if(driver){text('Every recorded lap · including first crossing',40,549,19,'#c6d9cc');text(driver.laps.length+' LAPS',40,585,22,'#a3f329');}text('cobracardiff.co.uk',910,615,18,'#a3f329');return cv.toBuffer('image/jpeg',40);
}
let pages=0,bytes=0;
for(const file of fs.readdirSync(path.join(root,'virtual-race-replay/races'))){if(!file.endsWith('.json'))continue;const race=JSON.parse(fs.readFileSync(path.join(root,'virtual-race-replay/races',file)));if(process.env.CHART_RACE&&race.id!==process.env.CHART_RACE)continue;
 for(const driver of [null,...race.drivers]){if(driver&&!driver.laps.length)continue;const suffix=race.id+'/'+(driver?encodeURIComponent(driver.key||driver.id)+'/':''),dir=path.join(out,suffix);fs.mkdirSync(dir,{recursive:true});const url=base+suffix,title=(driver?driver.name+' — lap times':race.name+' — race positions')+' | COBRA',description=race.event+' · '+race.date+' · Recorded race charts from COBRA Cardiff.',img=url+'preview.jpg';const jpg=preview(race,driver);bytes+=jpg.length;fs.writeFileSync(path.join(dir,'preview.jpg'),jpg);
 fs.writeFileSync(path.join(dir,'index.html'),addSiteShell(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${url}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${img}"><meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(title)}"><link rel="stylesheet" href="${driver?'../../../../':'../../../'}assets/lap-charts.css?v=1"><style>body{margin:0;background:#090f0b;color:white;font:16px Arial,sans-serif}main{max-width:1500px;margin:auto;padding:20px}header{padding:24px;background:linear-gradient(115deg,#040b07 44%,#07a31a)}a{color:#a3f329}.lap-charts{border:0}</style></head><body data-race="${race.id}" data-driver="${esc(driver?.key||driver?.id||'')}"><header><a href="https://www.cobracardiff.co.uk/">COBRA Cardiff</a><h1>${esc(title.replace(' | COBRA',''))}</h1><p id="raceName">${esc(description)}</p></header><main><section id="charts" class="lap-charts"><p>Loading interactive charts…</p></section><noscript><img src="preview.jpg" alt="${esc(title)}" style="max-width:100%"></noscript><p><a href="preview.jpg" download>Download chart image</a></p></main><script type="module" src="${driver?'../../../':'../../'}charts.js?v=20260928-shell"></script></body></html>`,driver?'../../../../':'../../../'));pages++;
 }
}
if(bytes>650*1024*1024)throw Error('Chart previews exceed the site media budget');
console.log(`Generated ${pages} social chart pages; ${(bytes/1024/1024).toFixed(1)} MB of JPEG previews.`);

