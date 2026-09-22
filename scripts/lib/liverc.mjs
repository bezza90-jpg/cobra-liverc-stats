const BASE_URL = 'https://cobracardiff.liverc.com';

function decodeHtml(value = '') {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—' };
  return String(value)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function cleanText(html = '') {
  return decodeHtml(String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function absoluteUrl(href = '') {
  if (!href) return '';
  return new URL(decodeHtml(href), BASE_URL).toString();
}

function extractLinks(html = '') {
  const links = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(html))) links.push({ href: absoluteUrl(match[1]), text: cleanText(match[2]) });
  return links;
}

function extractTables(html = '') {
  const tables = [];
  const tableRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;
  while ((tableMatch = tableRe.exec(html))) {
    const rows = [];
    const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRe.exec(tableMatch[1]))) {
      const cells = [];
      const cellRe = /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
      let cellMatch;
      while ((cellMatch = cellRe.exec(rowMatch[1]))) cells.push(cleanText(cellMatch[1]));
      if (cells.length) rows.push(cells);
    }
    if (rows.length) tables.push(rows);
  }
  return tables;
}

function idFromUrl(url, parameter = 'id') {
  try { return new URL(url).searchParams.get(parameter) || ''; }
  catch { return ''; }
}

export function normaliseName(name = '') {
  const cleaned = String(name)
    .replace(/\bView Laps\b/gi, '')
    .replace(/^\s*\d+\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  return cleaned === 'DAVID CLUTTERBUCK' ? 'DAVE CLUTTERBUCK' : cleaned;
}

export function driverKey(name = '') {
  return normaliseName(name).replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function normaliseEntryName(name = '') {
  const raw = String(name).replace(/\s+/g, ' ').trim().toUpperCase();
  if (!raw.includes(',')) return normaliseName(raw);
  const [surname, remainder = ''] = raw.split(',', 2).map(value => value.trim());
  let first = remainder;
  if (first.endsWith(surname)) first = first.slice(0, -surname.length).trim();
  const tokens = first.split(/\s+/).filter(Boolean);
  const tokenHalf = tokens.length / 2;
  if (Number.isInteger(tokenHalf) && tokens.slice(0, tokenHalf).join(' ') === tokens.slice(tokenHalf).join(' ')) {
    first = tokens.slice(0, tokenHalf).join(' ');
  } else {
    const compact = first.replace(/\s+/g, '');
    const charHalf = compact.length / 2;
    if (Number.isInteger(charHalf) && compact.slice(0, charHalf) === compact.slice(charHalf)) first = compact.slice(0, charHalf);
  }
  return normaliseName(`${first} ${surname}`);
}

function parseDate(value = '') {
  const firstDate = String(value).split(/\s+to\s+|\n/i)[0].trim();
  const machineDate = firstDate.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
  if (machineDate) return machineDate;
  const date = new Date(firstDate);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export function parseArchive(html) {
  const events = [];
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRe.exec(html))) {
    const rowHtml = rowMatch[1];
    const cells = [];
    const cellRe = /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowHtml))) cells.push(cleanText(cellMatch[1]));
    if (cells.length < 4) continue;
    const link = extractLinks(rowHtml).find(item => /p=view_event/.test(item.href));
    if (!link) continue;
    events.push({
      liveRcEventId: idFromUrl(link.href),
      name: cells[0],
      date: parseDate(cells[1]),
      entries: Number(String(cells[2]).replace(/,/g, '')) || 0,
      drivers: Number(String(cells[3]).replace(/,/g, '')) || 0,
      sourceUrl: link.href
    });
  }
  return events.filter(event => event.liveRcEventId && event.date);
}

export function parseEventIndex(html) {
  const links = extractLinks(html);
  const races = new Map();
  for (const link of links.filter(item => /p=view_race_result/.test(item.href))) {
    const liveRcRaceId = idFromUrl(link.href);
    if (liveRcRaceId) races.set(liveRcRaceId, { liveRcRaceId, sourceUrl: link.href, label: link.text });
  }
  return {
    entryList: links.find(item => /p=view_entry_list/.test(item.href))?.href || '',
    overall: links.find(item => /p=event_overall_ranking/.test(item.href))?.href || '',
    points: links.find(item => /p=view_points/.test(item.href))?.href || '',
    races: [...races.values()]
  };
}

export function parseQualifyingPoints(html) {
  const results = [];
  for (const rows of extractTables(html)) {
    if (!rows.length) continue;
    const className = rows[0][0].replace(/\s+Tie Breaker:.*$/i, '').trim();
    const headerIndex = rows.findIndex(row => row.includes('Driver') && (row.includes('#') || row.includes('Pos')));
    if (!className || headerIndex < 0) continue;
    const headers = rows[headerIndex];
    for (const row of rows.slice(headerIndex + 1)) {
      if (!/^\d+$/.test(row[0] || '') || row.length < 2) continue;
      const record = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']));
      const driverName = normaliseName(record.Driver);
      if (!driverName) continue;
      results.push({ className, driverName, qualifyingPosition: Number(row[0]) || null, pointsResult: record.Result || '', tieBreaker: record['Tie Breaker'] || '' });
    }
  }
  return results;
}

function parseClassTables(html) {
  const output = [];
  for (const rows of extractTables(html)) {
    if (!rows.length) continue;
    const className = rows[0].length === 1 ? rows[0][0] : '';
    const headerIndex = rows.findIndex(row => row.includes('Pos') && row.includes('Driver'));
    if (!className || headerIndex < 0) continue;
    const headers = rows[headerIndex];
    const records = rows.slice(headerIndex + 1)
      .filter(row => /^\d+$/.test(row[0] || '') && row.length >= 2)
      .map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
    output.push({ className, records });
  }
  return output;
}

export function parseEntryList(html) {
  const entries = [];
  let currentClass = '';
  for (const rows of extractTables(html)) {
    for (const row of rows) {
      if (row.length === 1 && !/^#?$/.test(row[0])) currentClass = row[0].replace(/\s+Entries:\s*\d+.*$/i, '').trim();
      if (row.length >= 2 && /^\d+$/.test(row[0]) && currentClass) {
        entries.push({ className: currentClass, driverName: normaliseEntryName(row[1]), transponder: String(row[2] || '').trim() });
      }
    }
  }
  return entries.filter(entry => entry.driverName);
}

export function parseOverall(html) {
  const results = [];
  for (const section of parseClassTables(html)) {
    for (const record of section.records) {
      const driverName = normaliseName(record.Driver);
      if (!driverName) continue;
      results.push({
        className: section.className,
        driverName,
        finalPosition: Number(record.Pos) || null,
        result: record.Result || record['Laps/Time'] || '',
        raceTier: String(record.Race || '').replace(/\s+/g, '-')
      });
    }
  }
  return results;
}

export function parseRace(html) {
  const rows = extractTables(html)[0] || [];
  const title = rows[0]?.[0] || '';
  const headerIndex = rows.findIndex(row => row.includes('Pos') && row.includes('Driver'));
  const headers = headerIndex >= 0 ? rows[headerIndex] : [];
  const records = rows.slice(headerIndex + 1)
    .filter(row => /^\d+$/.test(row[0] || '') && row.length >= 4)
    .map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
  const round = title.match(/Round:\s*(.*?)\s+Length:/i)?.[1]?.trim() || '';
  const raceName = title.replace(/\s+Round:[\s\S]*$/i, '').replace(/^\d+\s+/, '').trim();
  const mainLetter = raceName.match(/\b([A-Z])-Main\b/i)?.[1]?.toUpperCase() || '';
  const className = raceName.replace(/\s+[A-Z]-Main\b.*$/i, '').replace(/\s*\(Heat.*$/i, '').trim();
  return {
    title, round, raceName, className, mainLetter,
    isFinal: /Main Events/i.test(round) || /\b[A-Z]-Main\b/i.test(raceName),
    results: records.map(record => ({
      position: Number(record.Pos) || null,
      driverName: normaliseName(record.Driver),
      qualifyingPosition: Number(record.Qual) || null,
      lapsTime: record['Laps/Time'] || '',
      behind: record.Behind || '',
      fastestLap: record['Fastest Lap'] || '',
      averageLap: record['Avg Lap'] || '',
      consistency: record.Consistency || ''
    })).filter(result => result.driverName)
  };
}

const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export async function fetchText(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'COBRA statistics updater/2.0', Accept: 'text/html' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = new Error(`LiveRC request failed for ${url}: ${error.message}`);
      if (attempt < attempts) await pause(700 * attempt);
    }
  }
  throw lastError;
}

export { BASE_URL, pause };
