# Saved tracker road route

Calculated 5 October 2026 with OSRM driving geometry based on OpenStreetMap, retaining the existing Cardiff-to-Istanbul waypoints via Steyregg. The UK and continental road legs were routed separately; the link between Folkestone and Coquelles represents the Eurotunnel rail crossing rather than a road across the sea.

The saved route contains 6,883 points, simplified at 20 metres in projected coordinates (approximately 10–16 metres on the ground). Its routed distance including the crossing is 3,473.094 km. Display milestones now use positions on this route rather than the previous estimated distances. Recorded driver laps and mileage are unchanged; their map locations now reflect the saved road route.

The route module is about 149 KB uncompressed and 53,590 bytes gzip compressed. Visitors load it from RaceHub; no routing API runs at page load or during playback. Segment distances are calculated once and moving cars use a binary lookup without allocating a travelled-line array. The selected travelled line remains available for display.

Source: [OSRM route API](https://project-osrm.org/docs/v26.4.0/http), [OpenStreetMap contributors and licensing](https://www.openstreetmap.org/copyright). Route data and the existing map attribution credit OpenStreetMap. The route is a saved snapshot, not a live traffic route.

Verification: compact-route/endpoints/milestone and distance-lookup tests; tracker playback without view changes; unchanged final driver mileage; screenshot alignment check; approximately 16.7 ms median browser frame interval in the test environment. This is a desktop observation, not a guarantee for every device.
