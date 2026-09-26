import { BASE_URL, fetchText, parseArchive } from './lib/liverc.mjs';

const londonDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());
const events = parseArchive(await fetchText(`${BASE_URL}/events/`));
if (!events.length) throw new Error('Could not read the LiveRC event calendar; refusing to guess whether there is a race.');
const scheduled = events.filter(event => event.date === londonDate && !/(^|\b)(test|testing)(\b|$)/i.test(event.name));
const run = scheduled.length ? 'yes' : 'no';
console.log(`${londonDate}: ${scheduled.length ? scheduled.map(event => event.name).join(', ') : 'no scheduled COBRA race'}; afternoon refresh ${run}.`);
console.log(`run=${run}`);
