const normalize = value => String(value || '').trim().toLowerCase();

export function chassisChoice(override = {}, liveName = '') {
  const live = String(liveName || '').trim();
  if (!override.chassis) return live;
  if (override.mode === 'until-liverc-change' && live && normalize(live) !== normalize(override.livercAtSave)) return live;
  return override.chassis;
}

export function mergeOverrides(base = {}, manual = {}) {
  const merged = {...base, drivers:{...(base.drivers || {})}};
  for (const [key, rule] of Object.entries(manual.drivers || {})) {
    const previous = merged.drivers[key] || {};
    merged.drivers[key] = {
      ...previous,
      ...rule,
      classes:{...(previous.classes || {}), ...(rule.classes || {})}
    };
  }
  return merged;
}

const releaseChoice = (value, live) => {
  if (value.mode === 'until-liverc-change' && value.chassis && live && normalize(live) !== normalize(value.livercAtSave)) {
    value.previousManualChassis = value.chassis;
    value.chassis = '';
    value.replacedByLiveRC = live;
  }
};

export function releaseChangedChoices(overrides, brands) {
  for (const [key, value] of Object.entries(overrides.drivers || {})) {
    const live = brands[key]?.name || '';
    releaseChoice(value, live);
    for (const classChoice of Object.values(value.classes || {})) releaseChoice(classChoice, live);
  }
  return overrides;
}
