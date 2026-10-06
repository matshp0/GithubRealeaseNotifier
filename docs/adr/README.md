# Architectural Decision Records

Тут зібрані ключові архітектурні рішення проєкту GitHub Release Notifier.
Формат — спрощений [MADR 3.x](https://adr.github.io/madr/).

## Індекс

| #    | Назва                                                              | Статус   |
| ---- | ------------------------------------------------------------------ | -------- |
| [0001](0001-fastify-as-http-framework.md) | Fastify як HTTP-фреймворк                          | accepted |
| [0002](0002-postgresql-as-primary-datastore.md) | PostgreSQL як основне сховище              | accepted |
| [0003](0003-kysely-for-runtime-prisma-for-migrations.md) | Kysely для запитів, Prisma лише для міграцій | accepted |
| [0004](0004-etag-conditional-requests.md) | ETag-кондиційні запити для сканера            | accepted |

Шаблон для нових ADR — [`0000-template.md`](0000-template.md).
