const clamp=value=>Math.max(0,Math.min(255,Math.round(value)));
const hex=rgb=>`#${rgb.map(value=>clamp(value).toString(16).padStart(2,'0')).join('')}`;
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const DRIVER_OVERRIDES={
 'RUSS-WILLIAMS':{color:'#e31886',accentColor:'#f4f5f2',secondaryColor:'#f4f5f2',tertiaryColor:'#969b9d',wheelColor:'#f1f2ed',colorLayout:'front-accent'}
};

export function avatarColourOverride(key){return DRIVER_OVERRIDES[String(key||'')]||null;}

export function avatarThumbnailPath(manifest,key,className){
 const entry=manifest?.[key];
 const source=typeof entry==='string'?entry:entry?.[className]||entry?.default||'';
 if(!source)return'';
 return`../assets/car-avatar-thumbnails/${source.split('/').pop().replace(/\.png$/i,'.webp')}`;
}

export function analyseAvatarPixels(data,width,height){
 const histogram=(fromY,toY,colourOnly)=>{
  const bins=new Map();
  for(let y=Math.floor(height*fromY);y<Math.ceil(height*toY);y++)for(let x=0;x<width;x++){
   const i=(y*width+x)*4,r=data[i],g=data[i+1],b=data[i+2],a=data[i+3],high=Math.max(r,g,b),low=Math.min(r,g,b),chroma=high-low;
   if(a<80||high<58||(colourOnly&&chroma<24)||(!colourOnly&&high>244&&chroma<12))continue;
   const q=[r,g,b].map(value=>Math.min(7,value>>5)),key=q.join(','),weight=(a/255)*(1+chroma/95);
   const bin=bins.get(key)||{score:0,x:0,y:0};bin.score+=weight;bin.x+=x*weight;bin.y+=y*weight;bins.set(key,bin);
  }
  return[...bins.entries()].map(([key,bin])=>({rgb:key.split(',').map(value=>Number(value)*32+16),score:bin.score,x:bin.x/bin.score/width,y:bin.y/bin.score/height})).sort((a,b)=>b.score-a.score);
 };
 const shell=histogram(.04,.76,true),lower=histogram(.53,.98,false),primaryBin=shell[0],primary=primaryBin?.rgb,accentBin=shell.find(item=>primary&&distance(item.rgb,primary)>72),accent=accentBin?.rgb,thirdBin=shell.find(item=>primary&&distance(item.rgb,primary)>58&&(!accent||distance(item.rgb,accent)>58)),third=thirdBin?.rgb,wheel=lower[0]?.rgb;
 if(!primary)return null;
 const horizontal=accentBin&&primaryBin?accentBin.x-primaryBin.x:0,vertical=accentBin&&primaryBin?accentBin.y-primaryBin.y:0,colorLayout=Math.abs(horizontal)>.16?(horizontal>0?'front-accent':'rear-accent'):Math.abs(vertical)>.12?(vertical<0?'top-accent':'lower-accent'):'mixed';
 return{color:hex(primary),accentColor:hex(accent||primary),secondaryColor:hex(accent||primary),tertiaryColor:hex(third||accent||primary),wheelColor:hex(wheel||accent||[146,155,149]),colorLayout};
}

export async function loadAvatarColours(url){
 if(!url)return null;
 const image=new Image();image.decoding='async';image.src=url;await image.decode();
 const width=96,height=72,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:true});
 context.clearRect(0,0,width,height);const scale=Math.min(width/image.naturalWidth,height/image.naturalHeight),drawWidth=image.naturalWidth*scale,drawHeight=image.naturalHeight*scale;context.drawImage(image,(width-drawWidth)/2,(height-drawHeight)/2,drawWidth,drawHeight);
 return analyseAvatarPixels(context.getImageData(0,0,width,height).data,width,height);
}
