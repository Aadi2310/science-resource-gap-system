# Science Resource Gap API

Backend-only implementation of the API described in `Technical_Specification_Science_Resource_Gap_System.docx`.

## Requirements

- Node.js 20+
- PostgreSQL 14+
- Redis (for background jobs)

Copy `.env.example` to `.env`, set independent JWT secrets and service credentials, then run `npm install`, `npm run migrate`, and `npm run dev`. Create the first administrator with `npm run seed:admin`; the script reads `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_NAME` from the environment and never exposes an admin-registration API.

The API base path is `/api/v1`. Production migrations are forward-only. No frontend is included.
