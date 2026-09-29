// Keep every available avatar and the followed driver. Reduce ordinary pins by 5%.
export function trackerDrivers(drivers, recentKeys, avatars, activeKey = '') {
  const priority = drivers.filter(d => avatars.has(d.driverKey) || d.driverKey === activeKey);
  const ordinary = drivers.filter(d => !avatars.has(d.driverKey) && d.driverKey !== activeKey && (!recentKeys || recentKeys.has(d.driverKey)))
    .sort((a,b) => (b.lastDate || '').localeCompare(a.lastDate || '') || a.driverKey.localeCompare(b.driverKey));
  return [...priority, ...ordinary.slice(0, Math.ceil(ordinary.length * .95))];
}
