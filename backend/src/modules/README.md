# Backend feature modules

Each subfolder is a placeholder for a NestJS feature module that will be implemented in a later phase. In this
phase they intentionally contain nothing but a `README.md`: no modules, controllers, services, providers, or
DTOs exist yet, because phase 1 ships only the repository structure, tooling, and the Prisma data model. When a
module is implemented it will own its own `*.module.ts`, its service layer talking to Prisma, and its HTTP
surface, and it will be registered in `src/app.module.ts`.
