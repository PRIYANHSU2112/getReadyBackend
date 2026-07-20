# Architecture

## Overview

This project is a **modular monolith** with **module-local DI**.

- `createShared()` — shared tools only (JWT, EventBus, cache, auth)
- Each module — `createXxxModule(shared)` wires its own Repository → Service → Controller → Routes
- `routes/index.js` — mounts modules (no central feature container)

Modules communicate via **EventBus** (each module registers its own listeners).

## Layers (MVRSC)

| Layer | Folder file | Responsibility |
|-------|-------------|----------------|
| Model | `*.model.js` | Mongoose schema |
| Validation | `*.validation.js` | Joi DTOs |
| Repository | `*.repository.js` | DB access only |
| Service | `*.service.js` | Business logic |
| Controller | `*.controller.js` | HTTP mapping |
| Routes | `*.routes.js` | Express router |
| Docs | `*.docs.js` | OpenAPI fragments |
| Index | `index.js` | `createXxxModule()` factory |

## Adding a module

1. Copy `src/modules/user/` → export `createXxxModule(shared)`
2. In `src/routes/index.js`: call factory + `v1.use('/path', module.routes)`
3. Add docs to `src/core/swagger/docs.registry.js`
4. Call `module.registerEvents(shared.eventBus)` if needed

## Folder map

- `src/core/shared.js` — shared dependencies
- `src/app.js` — Express app only
- `src/routes/` — mount modules (module-local DI)
- `src/modules/` — feature modules
