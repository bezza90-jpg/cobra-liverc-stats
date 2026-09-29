export const youtubeDriverKey = 'MATTHEW-HODGES';

export function sharedRaceVideo(raceResults = [], videos = [], raceId, otherDriverKey = '') {
  const wantedRaceId = String(raceId || '');
  if (!wantedRaceId) return null;

  const drivers = new Set(
    raceResults
      .filter(row => String(row?.[0] || '') === wantedRaceId)
      .map(row => row?.[1])
  );

  if (!drivers.has(youtubeDriverKey)) return null;
  if (otherDriverKey && !drivers.has(otherDriverKey)) return null;

  return videos.find(video => String(video?.raceId || '') === wantedRaceId) || null;
}
