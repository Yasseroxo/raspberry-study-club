# Raspberry Study Club

A raspberry-themed student dashboard: planner, to-do list, assignments and deadlines, subjects with chapters, Pomodoro study room and a business toolkit (percentages, margins, break-even, VAT, averages). Light and dark themes. No framework, no build step.

## Run it
Open `index.html` in a browser, or host the folder on GitHub Pages / Netlify.

## Files
- `index.html`: page structure
- `styles.css`: design (colours and themes are at the top, in `:root`)
- `app.js`: all the logic. The `CONFIG` block at the top holds the app name, greeting, motivation messages and subject colours; `seed()` holds the sample data.

## Data
Everything is saved in the browser's localStorage (key `raspberry-study-club:v1`) on that device only. There is no account and no sync between devices.
