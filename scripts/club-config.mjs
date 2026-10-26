import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const defaultFile=new URL('../config/clubs/cobra.json',import.meta.url);

function configUrl(value=process.env.CLUB_CONFIG) {
  return value instanceof URL ? value : value ? pathToFileURL(resolve(value)) : defaultFile;
}

function required(value,label) {
  if (!String(value || '').trim()) throw new Error(`Club configuration is missing ${label}.`);
}

function validUrl(value,label,{optional=false}={}) {
  if (optional && !value) return;
  try { if (!/^https?:$/.test(new URL(value).protocol)) throw new Error(); }
  catch { throw new Error(`Club configuration ${label} must be an https:// or http:// URL.`); }
}

function validColour(value,label) {
  if (!/^#[0-9a-f]{6}$/i.test(String(value || ''))) throw new Error(`Club configuration ${label} must be a six-digit hex colour.`);
}

export function validateClubConfig(config) {
  if (config?.schemaVersion!==1) throw new Error('Club configuration schemaVersion must be 1.');
  for (const key of ['id','name','shortName','raceHubName','edition']) required(config[key],key);
  if (!['basic','full'].includes(config.edition)) throw new Error('Club configuration edition must be basic or full.');
  const featureNames=['bookings','checkIn','currentEvent','results','championships','podiums','trackGallery','schedules','briefing','setups','avatars','distanceTracker','replays','clubNews','guides','grandPrixWales'];
  for (const key of featureNames) if (typeof config.features?.[key]!=='boolean') throw new Error(`Club configuration features.${key} must be true or false.`);
  if (!config.features.bookings || !config.features.results) throw new Error('Club deployments require booking and results features.');
  for (const key of ['home','raceHub','events','media','contact']) validUrl(config.urls?.[key],`urls.${key}`);
  for (const key of ['header','footer','headerAlt']) required(config.logos?.[key],`logos.${key}`);
  validUrl(config.logos?.partnerUrl,'logos.partnerUrl',{optional:true});
  for (const key of ['primary','primaryBright','primaryDark','accent','ink','surface','wash']) validColour(config.theme?.[key],`theme.${key}`);
  if (!config.wix?.ticketTypes || typeof config.wix.ticketTypes!=='object') throw new Error('Club configuration requires wix.ticketTypes.');
  for (const [ticket,definition] of Object.entries(config.wix.ticketTypes)) {
    required(ticket,'a Wix ticket name');
    if (!Array.isArray(definition) || definition.length!==3 || definition.some(value=>!String(value || '').trim())) {
      throw new Error(`Wix ticket type ${ticket} must define class, transponder field and chassis field.`);
    }
  }
  return config;
}

export function loadClubConfig(file=process.env.CLUB_CONFIG) {
  return validateClubConfig(JSON.parse(readFileSync(configUrl(file),'utf8')));
}

export const clubConfig=loadClubConfig();

export function publicClubConfig(config=clubConfig) {
  return {
    schemaVersion:config.schemaVersion,id:config.id,name:config.name,shortName:config.shortName,
    raceHubName:config.raceHubName,edition:config.edition,features:config.features,urls:config.urls,logos:config.logos,theme:config.theme,
    footer:config.footer,social:config.social
  };
}
