import {readFileSync,writeFileSync} from 'node:fs';
import {siteHeader} from './site-shell.mjs';

const check=process.argv.includes('--check');
const root='https://racehub.cobracardiff.co.uk/';
const header=siteHeader(root);
const loader=`import {initSiteHeader,initBackToTop,initNavigationPrefetch} from './site-shell.js?v=6';

const markup=${JSON.stringify(header)};
const stylesheet=new URL('./site-shell.css?v=6',import.meta.url).href;

if(!document.querySelector('link[data-cobra-wix-shell]')){
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=stylesheet;
  link.dataset.cobraWixShell='';
  document.head.append(link);
}

const install=()=>{
  if(document.querySelector('.cobra-site-header')) return;
  const original=document.querySelector('header:not([data-cobra-original-header])');
  if(!original) return;
  const template=document.createElement('template');
  template.innerHTML=markup;
  const replacement=template.content.querySelector('.cobra-site-header');
  replacement.style.gridArea=getComputedStyle(original).gridArea;
  original.before(replacement);
  original.setAttribute('data-cobra-original-header','');
  original.style.setProperty('display','none','important');
  initSiteHeader(replacement);
  initBackToTop();
  initNavigationPrefetch();
};

new MutationObserver(install).observe(document.documentElement,{subtree:true,childList:true});
install();
`;
const links=readFileSync(new URL('../docs/wix-racehub-links.html',import.meta.url),'utf8').trim();
const snippet=`${links}\n<link rel="stylesheet" href="${root}assets/site-shell.css?v=6">\n<script type="module" src="${root}assets/wix-site-shell.js"></script>\n`;

const outputs=[
  [new URL('../public/assets/wix-site-shell.js',import.meta.url),loader],
  [new URL('../docs/wix-racehub-navigation.html',import.meta.url),snippet]
];
for(const [file,content] of outputs){
  if(check){
    if(readFileSync(file,'utf8')!==content) throw new Error(`${file.pathname} is out of date; run node scripts/build-wix-header.mjs.`);
  }else writeFileSync(file,content);
}
console.log(`Shared Wix header ${check?'checked':'built'}.`);
