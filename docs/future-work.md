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
