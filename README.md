# Forkcast Frontend

Vue 3 + Vite frontend for the food tracker app. Uses Axios to call the backend at `http://localhost:8000/api` and Pinia for state.

## Features
- Meal logging (record, update, delete, list)
- Insight mining (process meal log, list patterns)
- Food swaps (add/update foods, fetch suggested swaps)
- Personal Q&A (ask, list, answer)
- Quick check-ins (record, list)

## Development
1. Install deps
2. Run dev server

The token is stored in localStorage for simplicity via a Pinia store with persistence. For production, consider more secure storage and rotating tokens.

## Configuration
- API base URL is configured in `src/services/api.js`.
