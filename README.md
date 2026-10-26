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

During local development, the frontend defaults to `/api/v1` and Vite proxies
API requests to `http://127.0.0.1:8000`, avoiding browser CORS and localhost
origin mismatches. To use a different API server, set
`VITE_API_PROXY_TARGET` in the environment or configure the proxy in
`vite.config.js`, then restart Vite.

For a production build, set `VITE_API_BASE_URL` to the backend's reachable API
URL (for this deployment, `https://deploy-back-end-python.onrender.com/api/v1`)
or configure the web server to proxy `/api` to the backend. If the variable is
not set, production builds use this deployment's Render API URL by default;
local development continues to use Vite's `/api` proxy.

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
