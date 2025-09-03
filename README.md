![picks-and-sticks.webp](src%2Flib%2Fimages%2Fpicks-and-sticks.webp)

The world-famous NFL score pick 'em game known as Picks and Sticks game, which all started when someone forced me to eat a 🍒

## Getting Started

### Prerequisites

- Node.js v18+ and npm/yarn
- SQLite3

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/picks-and-sticks.git
cd picks-and-sticks
```

2. Install dependencies:
```bash
yarn install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Edit `.env` and add your TheSportsDB API key:
   - Get a free API key from [TheSportsDB](https://www.thesportsdb.com/api.php)
   - Update `API_KEY` in your `.env` file

5. Initialize the database:
```bash
npm run db:init
```

6. Seed initial data:
```bash
# Seed teams (run once)
curl http://localhost:5173/api/seed/teams

# Seed users
curl http://localhost:5173/api/seed/users

# Seed schedules for current season
curl http://localhost:5173/api/seed/schedules
```

7. Start the development server:
```bash
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173) to see the application.

## How It Works

This codebase powers a web application which has several functions:

- Picking and sticking, obviously
- Exposing several API endpoints which:
  - Retrieve data from [TheSportsDB](https://www.thesportsdb.com/) for team and schedule/score data and load the cleansed data into a SQLite database
  - Generate fake pick data for testing pick order week over week based on total score
  - Allow users to view week by week pick orders (via `/api/game/generate-order/week/{week}`), or view all week pick orders (via `/api/game/generate-order`)
  - More to come...

## API

Documentation via [Swagger file](https://swagger.io/blog/api-documentation/what-is-api-documentation-and-why-it-matters/) probably coming at some point but for now, here are some of the available endpoints:

### Populate APIs (`/api/seed`)

- `/users`
  - Seeds the `users` table with a few regulars (using pseudonyms for now)
- `/picks`
  - Seeds the `picks` table with fake data for every user in `users` and every game week in `schedules` (mostly used for testing)
- `/schedules`
  - Seeds the `schedules` table with actual game schedule data for a given year (defaults to 2024 right now) from thesportsdb.com
  - Game date, home & away teams initially
  - Pulls double duty by also updating games with scores as they become available!
- `/teams`
  - Seeds the `teams` table with all NFL teams from thesportsdb.com (only needs to run once unless the NFL expands/contracts)

### Game APIs (`/api/game`)

- `/pick-order`
  - Returns pick orders for all weeks. For week 1, this is randomly generated, so this endpoint will return a different order each time the endpoint is refreshed. All other weeks are fixed order according to the sum of points in the `picks` table for that week.
- `/pick-order/week/{week}`
  - For a given NFL week (1 through 18), returns the pick order for that week. For week 1, this is randomly generated, so this endpoint will return a different order each time at `/generate-order/week/1`. All other weeks are fixed order according to the sum of points in the `picks` table for that week.
  - `/generate-order/week/19` also returns data since it looks up the prior week's scores, but this is irrelevant for Picks and Sticks since we are only concerned with regular season play.
- `/randomize`
  - Legacy (yes, already) endpoint for testing the random order generation for week 1.

## Web Application

🚧 🚧 🚧 **Still under development** 🚧 🚧 🚧
