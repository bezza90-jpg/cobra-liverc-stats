const clamp=value=>Math.max(0,Math.min(255,Math.round(value)));
const hex=rgb=>`#${rgb.map(value=>clamp(value).toString(16).padStart(2,'0')).join('')}`;
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const DRIVER_OVERRIDES={
 'CHRIS-GUNTER':{color:'#e6007e',accentColor:'#f1268f',secondaryColor:'#e6007e',tertiaryColor:'#ff70b7',wheelColor:'#f2f2ef',colorLayout:'mixed'},
 'RUSS-WILLIAMS':{color:'#e31886',accentColor:'#f4f5f2',secondaryColor:'#f4f5f2',tertiaryColor:'#969b9d',wheelColor:'#f1f2ed',colorLayout:'front-accent'},
 'LEWIS-HOPKINS':{color:'#20ef4f',accentColor:'#5b1298',secondaryColor:'#f3f1e8',tertiaryColor:'#174cb7',wheelColor:'#eeeae0',colorLayout:'mixed'},
 'JON-TUCKER':{color:'#f01688',accentColor:'#18bce2',secondaryColor:'#6c1c92',tertiaryColor:'#f3d423',wheelColor:'#ef7fc2',colorLayout:'mixed'},
 'HARRY-DAVIS':{color:'#168fc9',accentColor:'#48bee9',secondaryColor:'#f2f1e9',tertiaryColor:'#737c84',wheelColor:'#eee9d9',colorLayout:'top-accent'},
 'MARK-GIAQUINTO':{color:'#f1d31e',accentColor:'#e63442',secondaryColor:'#f2eee4',tertiaryColor:'#171b18',wheelColor:'#eee8da',colorLayout:'front-accent'},
 'MATT-WOODIWISS':{color:'#f1df16',accentColor:'#18ae4b',secondaryColor:'#f3f2e8',tertiaryColor:'#f36a24',wheelColor:'#ecebe5',colorLayout:'mixed'},
 'MIKE-DRISCOLL':{color:'#f0df16',accentColor:'#ef7927',secondaryColor:'#efeee7',tertiaryColor:'#164b9b',wheelColor:'#ecebe7',colorLayout:'rear-accent'},
 'RICHARD-HARRISON':{color:'#411184',accentColor:'#168dc6',secondaryColor:'#f0eee7',tertiaryColor:'#1c2023',wheelColor:'#ece8df',colorLayout:'mixed'},
 'SEB-FISHER':{color:'#e8e7df',accentColor:'#9da29e',secondaryColor:'#f5f2e9',tertiaryColor:'#505653',wheelColor:'#eeeae0',colorLayout:'mixed'},
 'STEVE-CURTIS-RICH':{color:'#1edb35',accentColor:'#f1efe7',secondaryColor:'#c7923a',tertiaryColor:'#26322a',wheelColor:'#ecebe5',colorLayout:'mixed'},
 'STUART-IRONS':{color:'#18bd59',accentColor:'#1869b7',secondaryColor:'#e5ee16',tertiaryColor:'#17251f',wheelColor:'#e8ed18',colorLayout:'mixed'}
};

export function avatarColourOverride(key){return DRIVER_OVERRIDES[String(key||'')]||null;}

export function avatarThumbnailPath(manifest,key,className){
 const entry=manifest?.[key];
 const source=typeof entry==='string'?entry:entry?.[className]||entry?.default||Object.values(entry||{}).find(Boolean)||'';
 if(!source)return'';
 return`../assets/car-avatar-thumbnails/${source.split('/').pop().replace(/\.png$/i,'.webp')}`;
}

export function analyseAvatarPixels(data,width,height){
 const histogram=(fromY,toY,colourOnly,fromX=0,toX=1)=>{
  const bins=new Map();
  for(let y=Math.floor(height*fromY);y<Math.ceil(height*toY);y++)for(let x=Math.floor(width*fromX);x<Math.ceil(width*toX);x++){
   const i=(y*width+x)*4,r=data[i],g=data[i+1],b=data[i+2],a=data[i+3],high=Math.max(r,g,b),low=Math.min(r,g,b),chroma=high-low;
   if(a<80||high<58||(colourOnly&&chroma<24))continue;
   const q=[r,g,b].map(value=>Math.min(7,value>>5)),key=q.join(','),weight=(a/255)*(1+Math.min(chroma,96)/320);
   const bin=bins.get(key)||{score:0,x:0,y:0};bin.score+=weight;bin.x+=x*weight;bin.y+=y*weight;bins.set(key,bin);
  }
  return[...bins.entries()].map(([key,bin])=>{const rgb=key.split(',').map(value=>Number(value)*32+16);return{rgb,score:bin.score,x:bin.x/bin.score/width,y:bin.y/bin.score/height,chroma:Math.max(...rgb)-Math.min(...rgb),high:Math.max(...rgb)};}).sort((a,b)=>b.score-a.score);
 };
 const shell=histogram(.04,.76,true,.14,.86),neutralShell=histogram(.04,.7,false,.14,.86).filter(item=>item.chroma<36&&item.high>96),wheelCandidates=[...histogram(.2,.98,false,0,.27),...histogram(.2,.98,false,.73,1)].sort((a,b)=>b.score-a.score),primaryBin=shell[0],primary=primaryBin?.rgb,minimumAccentScore=Math.max(1.5,(primaryBin?.score||0)*.045),accentBin=shell.find(item=>primary&&item.score>=minimumAccentScore&&distance(item.rgb,primary)>72),accent=accentBin?.rgb||neutralShell[0]?.rgb,neutralBin=neutralShell.find(item=>primary&&distance(item.rgb,primary)>48),secondary=neutralBin?.rgb||accent,thirdBin=shell.find(item=>primary&&item.score>=minimumAccentScore&&distance(item.rgb,primary)>58&&(!accentBin||distance(item.rgb,accentBin.rgb)>58)),third=thirdBin?.rgb||neutralBin?.rgb||accent,wheelBin=wheelCandidates.find(item=>item.high>104&&item.score>=1.2)||wheelCandidates[0],wheel=wheelBin?.rgb;
 if(!primary)return null;
 const horizontal=accentBin&&primaryBin?accentBin.x-primaryBin.x:0,vertical=accentBin&&primaryBin?accentBin.y-primaryBin.y:0,colorLayout=Math.abs(horizontal)>.16?(horizontal>0?'front-accent':'rear-accent'):Math.abs(vertical)>.12?(vertical<0?'top-accent':'lower-accent'):'mixed';
 return{color:hex(primary),accentColor:hex(accent||primary),secondaryColor:hex(secondary||accent||primary),tertiaryColor:hex(third||secondary||accent||primary),wheelColor:hex(wheel||neutralBin?.rgb||accent||[146,155,149]),colorLayout};
}

export async function loadAvatarColours(url){
 if(!url)return null;
 const image=new Image();image.decoding='async';image.src=url;await image.decode();
 const width=96,height=72,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:true});
 context.clearRect(0,0,width,height);const scale=Math.min(width/image.naturalWidth,height/image.naturalHeight),drawWidth=image.naturalWidth*scale,drawHeight=image.naturalHeight*scale;context.drawImage(image,(width-drawWidth)/2,(height-drawHeight)/2,drawWidth,drawHeight);
 return analyseAvatarPixels(context.getImageData(0,0,width,height).data,width,height);
}
