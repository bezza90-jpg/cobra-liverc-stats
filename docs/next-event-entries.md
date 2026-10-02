# Next-event entries

The public Current Event, Race Day Schedule, Club Series and SWORD Championship pages show the next applicable LiveRC entry list. Entries are grouped by class and include country flag, driver, chassis and transponder.

## Data refresh

`npm run update` refreshes the event calendar and `public/data/next-event-entries.json` before rebuilding the remaining LiveRC data. The updater reads the next published COBRA meeting and its LiveRC entry list. This is also the command used by the scheduled results workflow and by the Site Manager **Refresh event entries** action.

LiveRC supplies the class, driver and transponder. Chassis names are joined from `public/data/liverc-chassis.json`. Country and chassis exceptions can be maintained in `public/data/next-event-entry-overrides.json`; the default country is `GB` when LiveRC has no country field.

Example override:

```json
{
  "defaultCountryCode": "GB",
  "drivers": {
    "DRIVER-NAME": {
      "countryCode": "GB-WLS",
      "chassis": "Team Associated"
    }
  }
}
```

The public component is loaded from `public/assets/event-entries.js`. It selects the next event for the current page, supports driver/class/chassis searching, and uses a compact card layout on phones.

Junior-price Wix tickets do not assign a driver to the junior heat when their event entry is in a senior race class. The browser's live booking merge uses that assignment too, so Harry Davis, Nathan Notley and Haiden Hicks stay in their senior classes. The junior heat count and space count use the same filtered roster.

For SWORD Round 1 on 4 October 2026, confirmed driver/class chassis values come from the organiser-approved master import CSV in confirmed-event-chassis.json. This public file contains only names, classes and chassis. It does not change transponders or create bookings. New drivers keep their Wix chassis, and the confirmed chassis override expires when the selected event changes.

The browser also applies the server's same-class unique-transponder nickname rule. Chris Leonard's Wix booking name CHRISWITHAC RC does not consume a second space. Two separately booked drivers sharing a transponder remain separate entries. Before the pending import, 2WD is 64 LiveRC entries plus Carl Turner and Justin Walsh from Wix:66 entered,14 of80 spaces remaining.
`nBob Gelstharp is displayed as Bob "Bobtech" Gelstharp. BOBTECH, BOB-GELSTHARP and BOB-BOBTECH-GELSTHARP all point to the existing BOBTECH profile and images. His confirmed 2WD and 4WD chassis are Schumacher.
