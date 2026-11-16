import { writeFile } from 'node:fs/promises';

const siteId = '20e7b764-0659-415c-a3b5-1d6bf9153068';
const eventId = '50b9c26d-f5c3-4b52-892e-f04509eb9730';
const ticketIds = {
  '2WD': 'c0986a4f-afb5-424c-905d-7ac73a571a33',
  '4WD': '83d70fd3-e2b1-4748-81db-8d1f94117c0d',
  '2WD Vintage': 'bd232bf5-3a38-4670-8fca-90cd5effa5f2',
  '4WD Vintage': '6b3206e0-ef56-4650-8f65-19eaf5c63919',
  'Stadium Trucks': '723aa999-fefa-49fc-89b4-6ed069606606'
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
