import { readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'public', 'data', 'videos.json');
const dashboard = JSON.parse(await readFile(path.join(root, 'public', 'data', 'dashboard.json'), 'utf8'));
const apiKey = process.env.YOUTUBE_API_KEY;
const channelHandle = 'Bezza90';
const channelUrl = 'https://www.youtube.com/@Bezza90';
const fromDate = '2025-01-01';
const driverKey = 'MATTHEW-HODGES';

if (!apiKey) {
  console.log('YOUTUBE_API_KEY is not configured; keeping the existing video index.');
  process.exit(0);
}

async function youtube(endpoint, parameters) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  for (const [key, value] of Object.entries({ ...parameters, key: apiKey })) url.searchParams.set(key, value);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`YouTube API ${response.status}: ${await response.text()}`);
  return response.json();
}

function titleDate(title) {
  const match = title.match(/(?:^|\D)(\d{2})(\d{2})(\d{2})(?:\D|$)/);
  if (!match) return '';
  const [, day, month, year] = match;
  return `20${year}-${month}-${day}`;
}

function titleClass(title) {
  if (/\b4\s*wd\b/i.test(title)) return '4-Wheel Drive Buggy';
  if (/\bjunior/i.test(title)) return 'Junior Racers';
  if (/\btruck/i.test(title)) return 'Trucks';
  if (/\bvintage\b/i.test(title)) return 'Vintage';
  return '2-Wheel Drive Buggy';
}

function titleRound(title) {
  const qualifier = title.match(/\bqual(?:ifying)?\s*(\d+)\b/i);
  if (qualifier) return { type: 'qualifier', number: Number(qualifier[1]), label: `Qual ${qualifier[1]}` };
  const final = title.match(/\b([A-H])\s*[- ]?final\b/i);
  if (final) return { type: 'final', letter: final[1].toUpperCase(), label: `${final[1].toUpperCase()} Final` };
  if (/\bfinal\b/i.test(title)) return { type: 'final', letter: '', label: 'Final' };
  return null;
}

function matchRace(eventId, className, round) {
  if (!round) return '';
  const candidates = Object.entries(dashboard.raceById).filter(([raceId, race]) => {
    if (race.e !== eventId || race.c !== className) return false;
    if (!dashboard.raceResults.some(result => result[0] === raceId && result[1] === driverKey)) return false;
    if (round.type === 'qualifier') return !race.f && new RegExp(`(?:round|qual(?:ifier|ifying)?)\\s*${round.number}\\b`, 'i').test(`${race.r} ${race.n}`);
    return race.f && (!round.letter || race.m === round.letter);
  });
  return candidates.length === 1 ? candidates[0][0] : '';
}

const channel = await youtube('channels', { part: 'contentDetails', forHandle: channelHandle });
const uploadsPlaylist = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
if (!uploadsPlaylist) throw new Error(`Could not resolve the uploads playlist for @${channelHandle}.`);

const sourceVideos = [];
let pageToken = '';
let reachedCutoff = false;
while (!reachedCutoff) {
  const page = await youtube('playlistItems', { part: 'snippet', playlistId: uploadsPlaylist, maxResults: '50', ...(pageToken ? { pageToken } : {}) });
  for (const item of page.items || []) {
    const publishedAt = item.snippet?.publishedAt || '';
    if (publishedAt && publishedAt.slice(0, 10) < fromDate) {
      reachedCutoff = true;
      continue;
    }
    sourceVideos.push(item);
  }
  pageToken = page.nextPageToken || '';
  if (!pageToken) break;
}

const videos = [];
for (const item of sourceVideos) {
  const title = item.snippet?.title || '';
  if (!/\bCOBRA\b/i.test(title)) continue;
  const date = titleDate(title);
  if (!date || date < fromDate) continue;
  const event = dashboard.events.find(row => row.d === date);
  if (!event) continue;
  const className = titleClass(title);
  const competed = dashboard.entries.some(row => row[0] === event.i && row[2] === className && row[3] === driverKey);
  if (!competed) continue;
  const round = titleRound(title);
  const videoId = item.snippet?.resourceId?.videoId;
  if (!videoId) continue;
  videos.push({
    id: videoId, title, publishedAt: item.snippet.publishedAt, eventId: event.i,
    raceId: matchRace(event.i, className, round), className,
    round: round?.label || '', url: `https://www.youtube.com/watch?v=${videoId}`,
    thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || ''
  });
}

videos.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.title.localeCompare(b.title));
const temporary = `${output}.tmp`;
await writeFile(temporary, `${JSON.stringify({ meta: { channel: channelUrl, fromDate, generatedAt: new Date().toISOString() }, videos })}\n`);
await rename(temporary, output);
console.log(`Matched ${videos.length} COBRA YouTube video(s) from 2025 onward.`);
