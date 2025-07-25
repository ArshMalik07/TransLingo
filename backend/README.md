# FastAPI Chat Backend

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Deployment (Render/Railway)
- Set entrypoint: `uvicorn app.main:app --host 0.0.0.0 --port 10000`
- Ensure `requirements.txt` is present
- SQLite DB will be created as `chat.db` in the backend folder 