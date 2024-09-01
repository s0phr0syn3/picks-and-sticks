# Picks and Sticks (or Sticks and Picks if you're nasty)

The world-famous NFL score pick 'em game known as Picks and Sticks game, which all started when someone forced me to eat a 🍒

## How It Works

This entirely self-contained codebase powers a web application which has several functions:
- Picking and sticking, obviously
- Exposing several API endpoints which:
  - Scrape pro-football-reference.com for team and schedule/score data and load the cleansed data into a SQLite database
  - Generate fake pick data for testing pick order week over week based on total score
  - Viewing week by week pick orders (via `/api/game/generate-order/week/{week}`), or viewing all week pick orders (via `/api/game/generate-order`)
  - More to come...

## API

Documentation via Swagger file probably coming at some point but for now, here are some of the available endpoints, all accessible from `{host}/api/`:

### Populate APIs (`/api/populate`)
- `/picks`
  - Seeds the `picks` table with fake data for every user in `users` and every game week in `weekSchedules` (mostly used for testing)
- `/schedules`
  - Seeds the `weekSchedules` table with actual game schedule data for a given year (defaults to 2024 right now) from pro-football-reference.com
  - Game date, game time, home & away teams initially
  - Pulls double duty by also updating games with scores as they become available!
- `/teams`
  - Seeds the `teams` table with all NFL teams from pro-football-reference.com (only needs to run once unless the NFL expands/contracts)

### Game APIs (`/api/game`)
- `/generate-order`
  - Returns pick orders for all weeks. For week 1, this is randomly generated, so this endpoint will return a different order each time the endpoint is refreshed. All other weeks are fixed order according to the sum of points in the `picks` table for that week.
- `/generate-order/week/{week}`
  - For a given NFL week (1 through 18), returns the pick order for that week. For week 1, this is randomly generated, so this endpoint will return a different order each time at `/generate-order/week/1`. All other weeks are fixed order according to the sum of points in the `picks` table for that week.
  - `/generate-order/week/19` also returns data since it looks up the prior week's scores, but this is irrelevant for Picks and Sticks since we are only concerned with regular season play. 
- `/randomize`
  - Legacy endpoint for testing the random order generation for week 1.

## Web Application

🚧 🚧 🚧 **Still under development** 🚧 🚧 🚧