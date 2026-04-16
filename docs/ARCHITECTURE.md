# Refactored Architecture

## Root
- `backend/`: Django backend
- `frontend/`: React frontend
- `docs/`: project documentation

## Backend
- `backend/config/`: project settings and entrypoints
- `backend/apps/`: domain apps (`users`, `predictions`, `admin_panel`, `data`)
- `backend/core/`: shared utilities and base helpers

### Users app
- Split into `views/` (`auth_views.py`, `user_views.py`, `other_views.py`)
- Added `serializers/` package (`auth_serializer.py`, placeholders for future growth)
- Added `services/` and `tests/` package layout

### Predictions app
- Split into `views/` (`prediction_views.py`, `model_views.py`, `common.py`)
- Split serializers into `serializers/request_serializer.py` and `serializers/model_serializer.py`
- Kept `services/` module-oriented business logic
- Moved tests into `tests/test_predictions.py`

## Frontend
- `src/layouts/`: shared layout components (`AppLayout.jsx`)
- `src/routes/`: routing config (`AppRoutes.jsx`) and route helpers (`RoleRoute.jsx`)
- `src/styles/`: global stylesheet (`global.css`)
- `src/services/`: API layer (`api.js`)
- `src/context/`: app context scaffold
- `src/utils/`: utility scaffold

The app behavior and existing endpoints were preserved while reorganizing modules for maintainability and scale.
