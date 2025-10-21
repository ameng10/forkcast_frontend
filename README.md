# Forkcast Frontend

Vue 3 + Vite app using Pinia and Axios. Backend base URL: http://localhost:8000/api

## Setup

- Node.js 18+
- Backend running at http://localhost:8000/api

## Install

```sh
npm install
```

## Run

```sh
npm run dev
```

Open the app at the URL shown (default http://localhost:5173).

## QuickCheckIns

- Set an Owner ID at the top.
- Define a metric (name + unit), then record check-ins by metric name and value.
- Filter and edit recent check-ins inline.

Auth token is stored via Pinia with localStorage persistence.
