# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs)

## React Compiler

The React Compiler is not enabled on this template because of its impact on build and development performance. To add it, see the [React Compiler installation documentation](https://react.dev/learn/react-compiler/installation).

## Local API setup

The frontend requests dynamic data from the FastAPI backend; it does not connect
to PostgreSQL directly. Start the backend from
`C:\python\Backend\Python_Final_Project_BackEnd\tripOsBack\tripos-backend`:

```powershell
python -m uvicorn app.main:app --reload
```

The frontend defaults to `http://127.0.0.1:8000/api/v1`. To use a different API
URL, copy `.env.example` to `.env.local`, set `VITE_API_BASE_URL`, and restart
Vite.

The backend must have valid PostgreSQL credentials in its `.env` file and its
migrations must be applied. From the backend project directory:

```powershell
Copy-Item .env.example .env
# Edit .env and set DATABASE_URL to match your PostgreSQL user, password, host, and database.
python -m alembic upgrade head
```

Do not commit the backend `.env` file or put database credentials in frontend
environment variables.

## Expanding the Oxlint configuration

For production development, consider TypeScript with type-aware lint rules.
See the [Vite React TypeScript template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts).
