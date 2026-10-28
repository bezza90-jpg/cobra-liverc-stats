# Future work

## COBRA mobile app for iPhone and Android

Create a mobile app that makes the full COBRA website feature set available on iPhone and Android.

The app should also:

- connect to the LiveRC websocket feed during race meetings;
- alert a driver when their next heat is approaching, with enough notice to prepare and reach the rostrum;
- show the live race order, timing and results available from the LiveRC main page;
- let drivers choose which entries, classes or transponders they want notifications for;
- handle temporary loss of venue connectivity without repeatedly sending stale alerts;
- use the same event, driver, result and replay data as the website so information remains consistent.

Before implementation, confirm the websocket messages and identifiers available from LiveRC, how reliably a driver can be matched to an entry, and the iOS and Android background-notification requirements.

## RC Paddock-style race analysis and presentation

Investigate useful RC Paddock-style features that could make RaceHub race data easier to understand, while reusing the LiveRC data already collected wherever possible.

Easy additions from existing lap data to assess:

- median lap time and lap-time variation;
- percentage of laps within a chosen margin of the driver's best pace;
- first-three versus last-three lap pace trend;
- gap to the class benchmark or leader;
- time lost to unusually slow laps;
- a concise, automatically generated race summary;
- one-tap comparison with the class leader or another driver.

Review the mobile presentation at the same time: compact two-column summary cards, clear Overview / Lap chart / Compare / Exact laps / Replay sections, collapsed exact-lap tables and progressive loading so the result and lap chart appear before secondary content.

Separately investigate setup notes attached to races, video synchronisation and optional AI reports. Treat a car racing-line view as a hardware/data project: LiveRC loop crossings provide lap times, not the car's path around the track, so a genuine racing line would require GPS, camera tracking or another position source.

Before implementation, compare the proposed metrics with RaceHub's existing Top 3/5/10/15 averages, consistency, pace, cRating, comparison charts and replay tools so new features add value rather than duplicate the current site.
