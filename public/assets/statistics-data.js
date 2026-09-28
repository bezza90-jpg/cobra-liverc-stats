// Optional video links must not delay the results or make them fail to load.
export async function loadStatisticsData(fetcher = fetch) {
  const videosReady = fetcher('data/videos.json', { cache: 'no-cache' })
    .then(response => response.ok ? response.json() : { videos: [] })
    .then(data => data.videos || [])
    .catch(() => []);
  const response = await fetcher('data/dashboard.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { data: await response.json(), videosReady };
}
