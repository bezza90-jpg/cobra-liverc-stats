export function eventSpaces(data, meeting, config) {
  if (!meeting || String(data.eventId) !== String(meeting.eventId) || data.date !== meeting.date) return [];
  const override = config.events?.[String(meeting.eventId)] || {};
  const limits = override.limits || config.types?.[meeting.type] || {};
  return Object.entries(limits).filter(([,limit]) => Number.isInteger(limit) && limit >= 0).map(([name,limit]) => {
    const published = data.entries.filter(entry => entry.className === name).length;
    const confirmed = override.confirmedMinimum?.[name] || 0;
    const reserved = override.reserved || config.reservedByType?.[meeting.type] || {};
    const missing = (reserved[name] || []).filter(key => !data.entries.some(entry => entry.className === name && entry.driverKey === key)).length;
    const publicLimit = Number(data.ticketLimits?.[name]);
    const heldFromWix = Number.isInteger(publicLimit) && publicLimit >= 0
      ? Math.max(0,limit-(reserved[name] || []).length-publicLimit)
      : 0;
    const held = Number.isInteger(override.held?.[name]) && override.held[name] >= 0 ? override.held[name] : heldFromWix;
    const entered = Math.max(published + missing + held, confirmed);
    return {name,limit,entered,reserved:missing + held,remaining:Math.max(0,limit-entered),confirmed:confirmed > published};
  });
}
