import {cp,mkdir,readFile,rm} from 'node:fs/promises';
import {clubConfig} from './club-config.mjs';

const source=new URL('../public/',import.meta.url);
const target=new URL('../dist/',import.meta.url);
const featurePaths={
  championships:['club','sword'],podiums:['podiums'],trackGallery:['track-gallery'],schedules:['schedule'],
  briefing:['briefing'],setups:['setups'],avatars:['avatar-upload','car-avatars'],replays:['virtual-race-replay','lap-charts'],
  clubNews:['club-news'],guides:['website-guides'],grandPrixWales:['grand-prix-wales']
};

await rm(target,{recursive:true,force:true});
await mkdir(target,{recursive:true});
await cp(source,target,{recursive:true});
for (const [feature,paths] of Object.entries(featurePaths)) {
  if (clubConfig.features[feature]) continue;
  for (const path of paths) await rm(new URL(path+'/',target),{recursive:true,force:true});
}
const publicConfig=JSON.parse(await readFile(new URL('data/club-config.json',target),'utf8'));
if (publicConfig.id!==clubConfig.id) throw new Error('Public club profile does not match this deployment. Run npm run build:club first.');
console.log(`Deployment bundle built for ${clubConfig.name} (${clubConfig.edition} edition).`);
