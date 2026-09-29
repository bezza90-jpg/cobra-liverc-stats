const normalize = value => String(value || '').trim().toLowerCase();
export function chassisChoice(override = {}, liveName = '') {
  const live = String(liveName || '').trim();
  if (!override.chassis) return live;
  if (override.mode === 'until-liverc-change' && live && normalize(live) !== normalize(override.livercAtSave)) return live;
  return override.chassis;
}
export function releaseChangedChoices(overrides, brands) {
  for (const [key, value] of Object.entries(overrides.drivers || {})) {
    const live = brands[key]?.name || '';
    if (value.mode === 'until-liverc-change' && value.chassis && live && normalize(live) !== normalize(value.livercAtSave)) {
      value.previousManualChassis = value.chassis;
      value.chassis = '';
      value.replacedByLiveRC = live;
    }
  }
  return overrides;
}
