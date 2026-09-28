import {readFileSync,writeFileSync} from 'node:fs';
import {siteHeader} from './site-shell.mjs';
const links=readFileSync(new URL('../docs/wix-racehub-links.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/assets/site-shell.css',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/assets/site-shell.js',import.meta.url),'utf8').replace('export function','function');
const header=siteHeader('https://racehub.cobracardiff.co.uk/');
const code=`${links}\n<style>\n${css}\n/* The original Wix header is retained for instant rollback. */\nheader[data-cobra-original-header]{display:none!important}\n</style>\n<script>\n(()=>{\n${js}\nconst markup=${JSON.stringify(header)};\nconst install=()=>{\n const original=document.querySelector('header:not(.cobra-site-header)');\n if(!original || original.hasAttribute('data-cobra-original-header')) return;\n const template=document.createElement('template');template.innerHTML=markup;\n const replacement=template.content.querySelector('.cobra-site-header');\n replacement.style.gridArea=getComputedStyle(original).gridArea;\n original.before(replacement);original.setAttribute('data-cobra-original-header','');\n initSiteHeader(replacement);\n};\nnew MutationObserver(install).observe(document.documentElement,{subtree:true,childList:true});\ninstall();\n})();\n</script>\n`;
writeFileSync(new URL('../docs/wix-racehub-navigation.html',import.meta.url),code);
console.log('Shared Wix header snippet built.');
