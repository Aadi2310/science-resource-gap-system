# Science Resource Gap System frontend

## Local integration with the API

The frontend uses the backend REST API in live mode by default. Copy `.env.example` to `.env.local` if you want to configure a different API address:

```powershell
Copy-Item .env.example .env.local
```

With the API listening at `http://localhost:3000`, the Vite development server proxies `/api/v1` to the backend. This avoids browser cross-origin requests during local development. Change `API_PROXY_TARGET` if the backend listens elsewhere. `VITE_API_BASE_URL` should normally remain `/api/v1` while using this proxy.

Start PostgreSQL and Redis, configure `backend/.env` from `backend/.env.example`, then run the backend and frontend in separate terminals:

```powershell
cd D:\IDEA_LAB\backend
npm.cmd install
npm.cmd run migrate
npm.cmd run dev
```

```powershell
cd D:\IDEA_LAB\frontend
npm.cmd install
npm.cmd run dev
```

Sign in with an account already registered in the backend. School and organisation accounts are created by `POST /api/v1/auth/register`; administrative and field coordinator accounts are created by the backend's documented admin workflow.

To use demonstration data, set `VITE_API_MODE=mock` in `.env.local`. Mock data and changes are kept in the browser and are not sent to the API.

For a production deployment, configure the hosting web server or gateway to serve the frontend and proxy `/api/v1` to the backend. Set `VITE_API_BASE_URL` to the externally reachable API prefix if the frontend and API are hosted on different origins. The backend currently does not enable CORS, so a cross-origin deployment requires same-origin proxying or a deliberate backend CORS configuration.

## Current API coverage

The typed client calls existing authentication, school detail/create, assessment, requirement lifecycle, resource catalogue, report, and administrator user endpoints. Pages do not fabricate live data where the API has no matching operation. In particular, the backend currently has no school collection/search endpoint or school profile update endpoint, and reports do not provide a global gap collection or a Field Coordinator summary. Those views identify the limitation in the UI.
