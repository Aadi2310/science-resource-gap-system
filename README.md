\# Science Resource Gap System



A backend system for identifying and prioritizing resource gaps in schools based on resource availability, requirements, student count, and resource condition.



\## Features



\- School registration and management

\- Resource assessment

\- Resource gap calculation

\- Priority scoring for requirements

\- Requirement management

\- Role-based access control

\- JWT-based authentication

\- Reports and analytics

\- PostgreSQL database

\- Database migrations and seed data



\## Tech Stack



\- Node.js

\- TypeScript

\- Express.js

\- PostgreSQL

\- JWT Authentication

\- Redis / BullMQ

\- SQL migrations



\## Project Structure



```text

backend/

├── migrations/

├── src/

│   ├── config/

│   ├── db/

│   ├── domain/

│   ├── jobs/

│   ├── middleware/

│   ├── modules/

│   └── shared/

├── .env.example

├── package.json

├── tsconfig.json

└── README.md

