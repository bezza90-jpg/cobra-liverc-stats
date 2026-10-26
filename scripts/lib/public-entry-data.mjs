const privateEntryFields = new Set(['transponder', 'transponderSource']);

export function publicEntryData(entry = {}) {
  return Object.fromEntries(Object.entries(entry).filter(([field]) => !privateEntryFields.has(field)));
}

export function publicEntryFeed(feed = {}) {
  return {...feed, entries:(feed.entries || []).map(publicEntryData)};
}
