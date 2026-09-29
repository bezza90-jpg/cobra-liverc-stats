// Apply only explicitly recorded identity mappings; never guess from a similar name.
export function entryIdentity(entry, aliases = {}) {
 const alias = aliases[entry.driverKey];
 if (!alias || !/^[A-Z0-9_-]+$/.test(alias.driverKey || '')) return entry;
 return {...entry, bookingName: entry.driverName, driverKey: alias.driverKey,
   driverName: alias.profileName || entry.driverName};
}
