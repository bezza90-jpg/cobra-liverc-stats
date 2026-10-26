import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {clubConfig,publicClubConfig} from './club-config.mjs';

const check=process.argv.includes('--check');
const dataFile=new URL('../public/data/club-config.json',import.meta.url);
const themeFile=new URL('../public/assets/club-theme.css',import.meta.url);
const json=JSON.stringify(publicClubConfig(clubConfig),null,2)+'\n';
const css=`:root{\n${Object.entries(clubConfig.theme).map(([key,value])=>`  --club-${key.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase())}:${value};`).join('\n')}\n  --green:var(--club-primary-bright);\n  --green-dark:var(--club-primary-dark);\n  --ink:var(--club-ink);\n  --surface:var(--club-surface);\n  --wash:var(--club-wash);\n}\n`;

for (const [file,content] of [[dataFile,json],[themeFile,css]]) {
  if (check) {
    if (await readFile(file,'utf8').catch(()=> '')!==content) throw new Error(`${fileURLToPath(file)} is out of date; run npm run build:club.`);
  } else {
    await mkdir(new URL('./',file),{recursive:true});
    await writeFile(file,content);
  }
}
console.log(`Club profile ${clubConfig.id} ${check?'checked':'built'}.`);
