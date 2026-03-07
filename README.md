# FPL Insight Engine

Demo-ready FPL analytics and prediction web app with Django + DRF backend and React frontend.

## Requirements
- Python 3.10+
- Node 18+
- Redis (for caching FPL API responses)
- PostgreSQL (matches current `backend/server/settings.py`)

## Environment
Copy `.env.example` to `.env` and export the variables in your shell (or use a dotenv loader).

```
FPL_BASE_URL=https://fantasy.premierleague.com/api
REDIS_URL=redis://127.0.0.1:6379/1
```

## Backend
From `backend/`:

```
pip install django-redis
python manage.py migrate
python manage.py runserver
```

## Frontend
From `frontend/`:

```
npm install
npm run dev
```

## Tests
From `backend/`:

```
python manage.py test predictions
```

## API Quickstart
- `GET /api/fpl/bootstrap/`
- `GET /api/fpl/fixtures/?gw=<int>`
- `POST /api/predictions/player-points/`
- `POST /api/predictions/price/`
- `POST /api/predictions/match/`
- `GET /api/predictions/fdr/?team_id=<int>&horizon=<int>`
