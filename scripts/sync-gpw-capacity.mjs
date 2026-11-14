import { writeFile } from 'node:fs/promises';

const siteId = '20e7b764-0659-415c-a3b5-1d6bf9153068';
const eventId = '7668b8c5-18ae-42f1-9ba9-aec8d55219a3';
const ticketIds = {
  '2WD': '830f92d1-f019-4452-91c9-63ec1c172558',
  '4WD': 'd5d13200-82fa-42b4-ba52-351cc2af249f',
  '2WD Vintage': 'cd09ef85-3a2b-4dfa-b5a6-6cbe2072e352',
  '4WD Vintage': '07c164ce-0a78-4e0c-91ef-b794ef9ca7c9',
  'Stadium Trucks': 'f888234a-e05c-4e4e-8bd6-f5d7e50ebca6'
};
const key = process.env.WIX_API_KEY;
if (!key) throw Error('Wix capacity sync needs WIX_API_KEY.');

const stock = await Promise.all(Object.entries(ticketIds).map(async ([className, id]) => {
  const response = await fetch('https://www.wixapis.com/events-ticket-definitions/v3/ticket-definitions/' + id + '?fields=SALES_DETAILS', {
    headers: { Authorization: key, 'wix-site-id': siteId },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw Error(`Wix stock for ${className} returned ${response.status}.`);
  const { ticketDefinition } = await response.json();
  const unsold = ticketDefinition?.salesDetails?.unsoldCount;
  if (ticketDefinition?.eventId !== eventId || !Number.isSafeInteger(unsold) || unsold < 0) {
    throw Error(`Wix returned invalid stock for ${className}.`);
  }
  return [className, unsold];
}));

await writeFile(new URL('../public/grand-prix-wales/data/capacity.json', import.meta.url),
  JSON.stringify({ remaining: Object.fromEntries(stock) }, null, 2) + '\n');
