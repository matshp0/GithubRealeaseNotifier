# Запуск тестів

## Підготовка

```bash
pnpm install
```

## Юніт-тести

Не потребують Docker або зовнішніх сервісів.

```bash
pnpm test:unit
```

## Інтеграційні тести

Потрібен Docker. Testcontainers автоматично піднімає PostgreSQL і Mailpit, запускає міграції, виконує тести і зупиняє контейнери.

```bash
pnpm test:integration
```
