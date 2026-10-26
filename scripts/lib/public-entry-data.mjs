const privateEntryFields = new Set(['transponder', 'transponderSource']);

export function juniorPublicName(value = '') {
  const words = String(value).trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (words.length < 2) return words[0] || '';
  return `${words[0]} ${words.at(-1).slice(0, 1).toUpperCase()}.`;
}

export function publicEntryData(entry = {}) {
  const output = Object.fromEntries(Object.entries(entry).filter(([field]) => !privateEntryFields.has(field)));
  if (output.className === 'Junior Racers') {
    output.driverName = juniorPublicName(output.driverName);
    delete output.driverKey;
    delete output.bookingName;
  }
  return output;
}

export function publicEntryFeed(feed = {}) {
  return {...feed, entries:(feed.entries || []).map(publicEntryData)};
}
