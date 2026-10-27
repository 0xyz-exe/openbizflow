# Contributing to OpenBizFlow

Thank you for your interest in contributing to OpenBizFlow! We welcome contributions to make open-source business automation accessible to everyone.

## Development Setup

### Backend (FastAPI)
```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
pytest -v
```

### Frontend (React + Vite)
```bash
cd apps/web
npm install
npm run dev # or npm run build
```

## Pull Request Guidelines
1. Ensure all backend tests pass: `pytest -v`
2. Ensure frontend compiles cleanly: `npm run build`
3. Maintain tenant isolation in any new database queries.
4. Keep dependencies minimal.
