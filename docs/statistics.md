# Statistics and scoring

[Back to the main README](../README.md)

## Statistics and profiles

The statistics page includes a searchable leaderboard, driver profiles, head-to-head comparisons and an event/race explorer with LiveRC links. Profiles include activity totals, qualifying and finishing results, class breakdowns, consistency and race history.

The default date range is the rolling year ending at the latest imported event. The default leaderboard requires ten finals; the selector also offers 1, 5, 20 and 30. Filters include event type and class. “All senior classes” excludes Junior Racers results.

Ranking options include average finish, performance, finals, laps, distance, time on track, runs, wins, podiums, TQs, finishing rates, consistency, fastest lap, qualifying position and places gained.

- **Leaderboard results:** published overall final positions.
- **Attendance adjustment:** each metric's input values are sorted and its worst values removed before averaging. Fewer than ten values lose none; ten lose one, fifteen lose two, and so on. Finish and performance use final-result values; consistency uses eligible consistency-run values. Activity totals are not reduced.
- **Performance:** finishing position is normalised to the field size; first place receives 100.
- **Consistency:** eligible runs require known scheduled duration, at least five laps and recorded time at least as long as the scheduled duration. Missing duration information makes a run ineligible. The profile bands are 98%+, 95–97.9%, 90–94.9% and below 90%.
- **Distance:** an estimate using 150 metres per completed lap, displayed in miles. The tracker visualises equivalent distance along an illustrated route rather than actual driver travel.
- **Event head-to-head:** both drivers have overall final results in the same class at the same event.
- **Same-final head-to-head:** both drivers race in the same main final; practice and qualifying are excluded.

The calculations are implemented in [app.js](../public/assets/app.js).

## Championships

SWORD and Club tables offer the seasons present in the archive, using September-to-April date windows and the settings in [championships.json](../public/data/championships.json).

- First place receives 100 points, reducing by one point per position.
- TQ earns one bonus point.
- Up to the best four rounds count.
- DNS/DNF retain points for their published overall position.
- The highest dropped score breaks a total-points tie; if that also matches, the position remains tied.
- Seasons whose start predates the retained archive are labelled partial, including Club 2021/22.

[championship.js](../public/assets/championship.js) calculates the tables. The generated `championship-results.json` contains the same event results as the full dashboard, without individual-run data. Regression tests compare standings across every available season and configured class.

## Import rules

The [LiveRC updater](../scripts/update-liverc.mjs) imports events dated 1 January 2022 onward. It ignores test/testing events, future events and events with no entries, and checks the required entry, qualifying, overall and race-result data. LiveRC IDs identify records and prevent duplicate imports.

Event `449348` is explicitly excluded as an unfinished duplicate of `450264`. At most two eligible new or changed events are processed in each run. The archive reflects the imported source records; it should not be treated as a guarantee that every historical meeting is available.
