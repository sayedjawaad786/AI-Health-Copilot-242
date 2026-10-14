# Health Copilot

> AI-powered personal health assistant – hackathon project.

Upload a prescription, lab report, or discharge summary and receive:
- Structured extraction of medications, lab observations, and diagnoses
- FHIR-style bundle with mock ABHA patient profile
- Patient-friendly summary in English, Hindi, Telugu, or Tamil
- Chronological health timeline with severity indicators

## Repository layout

```
health-copilot/
├── backend/   FastAPI + Google Gemini – see backend/README.md
├── frontend/  (coming next)
└── README.md
```

## Getting started

See [backend/README.md](backend/README.md) for backend setup instructions.

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11+, FastAPI, Pydantic v2 |
| AI | Google Gemini (`gemini-1.5-flash`) |
| Health standards | FHIR-inspired data model, ABHA mock profile, ICD-10, LOINC |
| Frontend | Vite + React (coming next) |