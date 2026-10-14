# Health Copilot – Backend

FastAPI backend for the Health Copilot AI health assistant.

## Quick start

```bash
# 1. Create and activate a virtual environment
python -m venv venv
# Windows PowerShell
.\venv\Scripts\Activate.ps1
# macOS / Linux
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# 4. Start the development server
uvicorn app.main:app --reload
```

The API will be available at **http://localhost:8000**.

| URL | Description |
|---|---|
| `GET  /health` | Liveness probe – returns `{"status": "ok"}` |
| `GET  /docs` | Swagger UI (interactive API explorer) |
| `GET  /redoc` | ReDoc API documentation |
| `POST /api/records/analyze` | Analyse a health document (multipart) |
| `GET  /api/records/sample` | Return sample bundle (no upload needed) |

## Project layout

```
backend/
├── app/
│   ├── main.py          # FastAPI app, CORS, router mounting
│   ├── config.py        # pydantic-settings (loads .env)
│   ├── schemas/
│   │   └── health.py    # All Pydantic v2 domain models
│   ├── services/        # Business logic (Gemini integration – coming next)
│   └── routers/
│       └── records.py   # /api/records/* endpoints
├── requirements.txt
├── .env.example
└── README.md
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | *(required)* | Google AI Studio / Vertex AI API key |
| `GEMINI_MODEL` | `gemini-1.5-flash` | Gemini model to use |
| `MAX_UPLOAD_MB` | `10` | Maximum upload file size in MB |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | CORS origins (comma-separated) |
