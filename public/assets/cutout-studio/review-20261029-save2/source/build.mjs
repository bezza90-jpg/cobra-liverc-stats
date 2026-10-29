import {build} from 'esbuild';
import {mkdir,copyFile,writeFile,readFile} from 'node:fs/promises';
await mkdir('dist/assets',{recursive:true});
await build({entryPoints:['src/app.js'],outdir:'dist/assets',bundle:true,format:'esm',splitting:true,target:'es2022',minify:true,chunkNames:'[name]-[hash]',legalComments:'linked'});
for(const name of ['index.html','style.css'])await copyFile('src/'+name,'dist/'+name);
await copyFile('node_modules/@imgly/background-removal/LICENSE.md','dist/LICENSE.txt');
await copyFile('node_modules/@imgly/background-removal/ThirdPartyLicenses.json','dist/ThirdPartyLicenses.json');
// Supply the complete application source and pinned dependencies to its users.
const files=['package.json','pnpm-lock.yaml','build.mjs','src/app.js','src/core.js','src/review.js','src/review-transport.js','pnpm-workspace.yaml','src/index.html','src/style.css'];
await mkdir('dist/source',{recursive:true});
for(const file of files){await mkdir('dist/source/'+file.split('/').slice(0,-1).join('/'),{recursive:true});await copyFile(file,'dist/source/'+file);}
await writeFile('dist/source/index.html','<!doctype html><meta charset="utf-8"><title>Cutout Studio source</title><h1>COBRA Cutout Studio source</h1><p>AGPL-3.0-only. '+files.map(f=>'<a href="'+f+'">'+f+'</a>').join(' · ')+'</p><p>Install the pinned dependencies with pnpm install, then pnpm build. Background removal: <a href="https://github.com/imgly/background-removal-js">IMG.LY source</a>. <a href="../LICENSE.txt">Licence</a>.</p>');
