# Platform Console Studio Screen

Xigi Platform — Monorepo for the shared backend and all frontend applications.

## Architecture

```
├── backend/                  ← Shared Django backend (all apps)
│   ├── Main/                 ← Django project settings
│   ├── console/              ← Console app (screens, campaigns, users)
│   ├── manage.py
│   └── ...
│
├── frontends/                ← Independent frontend applications
│   ├── console/              ← Console Dashboard (React + Vite)
│   ├── studio/               ← Studio Dashboard (TBD)
│   ├── screens/              ← Screens Dashboard (TBD)
│   └── xia/                  ← XIA Dashboard (TBD)
│
├── .gitignore
└── README.md
```

## Getting Started

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate     # Linux/Mac
venv\Scripts\activate        # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

### Console Frontend Setup

```bash
cd frontends/console
npm install
npm run dev
```

## Team Structure

| Module  | Frontend Path        | Backend App    |
| ------- | -------------------- | -------------- |
| Console | `frontends/console/` | `backend/console/` |
| Studio  | `frontends/studio/`  | `backend/studio/`  |
| Screens | `frontends/screens/` | `backend/screens/`  |
| XIA     | `frontends/xia/`     | `backend/xia/`     |
