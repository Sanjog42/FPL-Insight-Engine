# FPL Insight Engine

FPL analytics and prediction web app with a Django + DRF backend and React (Vite) frontend.

## Requirements
- Python 3.10+
- Node 18+
- PostgreSQL (default DB in `backend/config/settings.py`)
- Redis (optional, for cache; falls back to local memory cache when `REDIS_URL` is empty)

## Backend Setup
From `backend/`:

```bash
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Default database settings are currently hardcoded in `backend/config/settings.py`:
- DB name: `fpl_db`
- User: `fpl_user`
- Password: `fpl1234`
- Host: `localhost`
- Port: `5432`

## Environment Variables
Current backend settings read:

```bash
FPL_BASE_URL=https://fantasy.premierleague.com/api
REDIS_URL=
```

## Frontend Setup
From `frontend/`:

```bash
npm install
npm run dev
```

Frontend API base URL is currently defined in:
- `frontend/src/services/api.js` (`API_BASE = "http://127.0.0.1:8000"`)

## Tests
From `backend/`:

```bash
python manage.py test apps.predictions
```

## API Quickstart
- `GET /api/fpl/bootstrap/`
- `GET /api/fpl/fixtures/?gw=<int>`
- `POST /api/predictions/player-points/`
- `POST /api/predictions/price/`
- `POST /api/predictions/match/`
- `GET /api/predictions/fdr/?team_id=<int>&horizon=<int>`

## Notes
- Do not commit local `.env` files.
