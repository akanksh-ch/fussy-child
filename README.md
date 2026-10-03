# Fussy Child

Guess which food Timmy wants from 12 items across Fruit, Bakery, and Cake.
Use the mouse or arrow keys and Enter. Rejected foods are marked and cannot be offered again.
Timmy compares each offer with his secret food and remembers earlier replies. Sensible guesses earn useful differences; guesses that ignore clues get reminders.
Press N for a new game and R to replay the voice.

## Run

Use Node.js 22 or newer. In `backend/`, run `npm install`, configure `.env` from `.env.example`, then `npm run dev`.
In `frontend/`, run `npm install`, then `npm run dev-nolog`. Open http://localhost:8080.

## Check

Run `bash backend/test.sh` for offline backend and HTTP checks.
In `frontend/`, run `npm test`, `npm run check`, and `npm run build-nolog`.
Backend live checks (`bash backend/test.sh --live`) use configured API keys and credits.

The shared catalogue is `shared/items.json`. Deploy frontend and backend together when changing the API.
See [backend API documentation](backend/README.md).
