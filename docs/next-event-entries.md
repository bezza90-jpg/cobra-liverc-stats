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
