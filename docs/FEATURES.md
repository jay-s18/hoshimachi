# Features

Everything Hoshimachi does, grouped by what the user is trying to do. Use the comparison table at the end to check competitors against the same list.

## Plan a trip

| Feature                       | What it does                                                                                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trip odds for any dates       | For the arrival and departure dates you pick, the chance of at least one good night, for each of 994 regions (~28 km squares) across Japan. Works for any dates: weeks or months ahead, not just the next few days. |
| Ranked list of regions        | Regions sorted by odds (or by darkness), with prefecture, Bortle class, distance and the uncertainty range.                                                                                                         |
| Honest ties                   | A dashed line marks where odds become clearly lower than #1. Everything above it is within the uncertainty of the top region, so the user can treat those as tied.                                                  |
| Your own definition of "good" | How many clear, dark hours a night needs (1–10), in a row or with passing clouds allowed.                                                                                                                           |
| Milky Way mode                | Counts only hours when the Milky Way core is at least 10° up, as well as dark and moon-free.                                                                                                                        |
| Darkness filter               | Hide regions whose darkest spot is brighter than Bortle 1–5.                                                                                                                                                        |
| Distance filter               | Straight-line distance from 9 cities (Tokyo, Osaka, Nagoya, Sapporo, Sendai, Fukuoka, Hiroshima, Kanazawa, Naha) or anywhere in Japan.                                                                              |
| Moon each night               | Moon phase for every night of the trip and how many dark hours the moon costs.                                                                                                                                      |
| Default to the next new moon  | The app opens on the next new-moon dates, the best time to go.                                                                                                                                                      |
| Filter by name                | Narrow the list by town or prefecture name, in English or Japanese.                                                                                                                                                 |

## Understand one place (the region card)

| Feature                   | What it does                                                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Pin any point             | Click anywhere on the map to read that exact ~1 km spot. Each region also opens at its own darkest spot.                                        |
| Detailed place name       | The pin shows the local district name (e.g. 野辺山) and the town, county and prefecture above it.                                               |
| Bortle class at the pin   | Estimated Bortle class and sky brightness (mag/arcsec²) for the ~1 km spot.                                                                     |
| What you'll see here      | For that Bortle class: roughly how many stars are visible at once, how the Milky Way looks, and an illustrated sky. Tap classes 1–9 to compare. |
| Sky from the pin          | A 360° panorama of the horizon glow from towns and cities, the brightest direction, and the town most responsible.                              |
| Night by night            | For each night: moon phase, the usable dark hours (e.g. 19:00–23:00) and that night's odds.                                                     |
| Expected good nights      | How many good nights to expect over the whole trip.                                                                                             |
| How much luck is involved | The same dates in each past year, filled where at least one night was good, to show how much outcomes swing.                                    |
| What actually happened    | If the dates fall inside the 2015–2024 record, what happened that year (left out of the odds, so the odds can't peek).                          |
| Best months               | A month-by-month chart of how often nights are clear there, and the best month.                                                                 |
| Light-pollution trend     | Change in night light since 2014 in % per decade: at the exact ~1 km pin, and for the whole region.                                             |
| Towns in the region       | The towns inside each ~28 km square.                                                                                                            |
| Quick links               | Open the spot in Google Maps, the GSI terrain map (地理院地図) or Windy's live clouds, or copy its coordinates.                                 |

## Live weather (trips within a week)

| Feature              | What it does                                                                                                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Forecast in the odds | A checkbox mixes the Japan Meteorological Agency's cloud forecast into the odds for nights in the next week. Nearer nights trust the forecast more. Off by default to protect the free weather service's shared limit. |
| Forecast at the pin  | The next 8 nights hour by hour at the pinned spot: cloud cover with the usable dark hours outlined, clear hours, low temperature, wind, rain and a dew warning.                                                        |

## Maps

| Feature          | What it does                                                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trip odds map    | Every region coloured by its odds for your dates. Regions failing your filters are darkened.                                                                      |
| Month odds map   | How often nights are clear in the month of your trip, for planning a season rather than exact dates.                                                              |
| Darkness map     | Estimated sky brightness (Bortle class) at ~1 km, on a smooth colour scale.                                                                                       |
| Light trend map  | Which places are getting brighter or darker, drawn from the exact ~1 km values (the same numbers the pin reads).                                                  |
| Base maps        | Plain, roads (labels appear only once zoomed in) or terrain, from the Geospatial Information Authority of Japan.                                                  |
| Stargazing spots | Certified International Dark Sky Places, well-known stargazing spots and the author's own field-tested spots. Click one to open it.                               |
| Place search     | Search any place in Japan, in English or Japanese. Suggestions drop down as you type: Hoshimachi's spots and towns first, then places from OpenStreetMap and GSI. |
| Overlay opacity  | A slider for how strongly each layer covers the map.                                                                                                              |

## Use and share

| Feature                   | What it does                                                                                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| English and Japanese      | Every label, note, tooltip and the How it works page in both languages. Opens in Japanese for Japanese browsers and remembers the choice.                         |
| Shareable links           | The address bar always holds the dates, settings, language and pinned spot. Share copies it, and the link reopens the exact view.                                 |
| Red light mode            | Turns the screen red and dim, to protect night vision in the field. The normal interface is already dark and warm.                                                |
| Colour-blind safe colours | Every colour scale gets lighter as its value rises, so it reads in greyscale and for colour-blind viewers.                                                        |
| Explanations everywhere   | An "i" button next to every setting and section explains it in plain words. How it works covers the method and its limits.                                        |
| Works on phones           | The layout adapts to narrow screens.                                                                                                                              |
| Works offline             | A single-file version (about 6 MB, data included) opens from disk with no internet. The live forecast, place names, place search and base maps then don't appear. |
| Free, no account          | No sign-up, no ads, no analytics. No API key is needed for any service.                                                                                           |

## Trust and method

| Feature                  | What it does                                                                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real weather history     | Odds replay 10 years (2015–2024) of hourly ERA5 cloud data through the exact dark, moon-free hours of your dates, keeping the way bad weather comes in multi-day spells.               |
| Uncertainty shown        | Every odds figure has a 95% range from year-to-year variation.                                                                                                                         |
| Validated out of sample  | Settings were chosen on 2021–2022 and tested once on 2023–2024: about 725,000 predictions per trip length (1, 3 and 5 nights), about 2.2 million in all. Results are shown in the app. |
| Limitations stated       | The app lists what the model ignores (local fog, terrain hiding towns, LEDs the satellite under-sees, and so on).                                                                      |
| Updates itself each year | Adding a year of data needs no code changes. The pipeline rebuilds, re-validates and refuses to publish if the model gets worse.                                                       |

## Compare with competitors

Fill in a column per competitor: ✓ has it, ~ partly, ✗ doesn't. Check each one in the competitor's app rather than from memory.

| Feature                                | Hoshimachi | lightpollutionmap.app | Other |
| -------------------------------------- | :--------: | :-------------------: | :---: |
| Clear-night odds for any future dates  |     ✓      |                       |       |
| Ranked list of best regions for a trip |     ✓      |                       |       |
| Uncertainty range and honest ties      |     ✓      |                       |       |
| Own definition of a good night         |     ✓      |                       |       |
| Milky Way core visibility              |     ✓      |                       |       |
| Moon hours per night                   |     ✓      |                       |       |
| Darkness (Bortle) map                  |     ✓      |                       |       |
| Bortle at an exact point               |     ✓      |                       |       |
| Stars visible and Milky Way per class  |     ✓      |                       |       |
| Horizon glow panorama                  |     ✓      |                       |       |
| Light-pollution trend over years       |     ✓      |                       |       |
| Best months for a place                |     ✓      |                       |       |
| Past years on the same dates (luck)    |     ✓      |                       |       |
| Live cloud forecast                    |     ✓      |                       |       |
| Forecast blended into the odds         |     ✓      |                       |       |
| Place search                           |     ✓      |                       |       |
| Detailed place names                   |     ✓      |                       |       |
| Dark-sky places and stargazing spots   |     ✓      |                       |       |
| Japanese language                      |     ✓      |                       |       |
| Shareable links                        |     ✓      |                       |       |
| Red light mode                         |     ✓      |                       |       |
| Works offline                          |     ✓      |                       |       |
| Validated against held-out years       |     ✓      |                       |       |
| Free, no account                       |     ✓      |                       |       |
| Worldwide coverage                     |     ✗      |                       |       |
| Ground (SQM) measurements              |     ✗      |                       |       |
| Mobile app                             |     ✗      |                       |       |
