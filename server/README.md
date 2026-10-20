# Water System database

Node.js 22 or newer. The migration files reproduce the 18 tables entered manually
in phpMyAdmin. The Express API is a later step; these commands only manage schema
history and the office seed. No admin account, sample customers or passwords are seeded.

## Setup

In a terminal opened at `water_system`:

```powershell
cd server
npm install
Copy-Item .env.example .env
```

Edit `.env` for the intended database. Local XAMPP commonly uses `127.0.0.1`, port
`3306`, database `water_system`, user `root`, and an empty password. Use your actual
settings. For a VPS, use a dedicated user and password. Never commit `.env`.
Commit the generated `package-lock.json` after install; deployments can then use `npm ci`.

The database must already exist with utf8mb4 encoding. The runner does not create
databases or install MySQL/MariaDB. The user needs DDL permissions for migrations
and metadata visibility for schema inspection. Current target: MariaDB 10.4.32;
MySQL 8.0.16+ is the intended alternative (both should be integration-tested before deployment).

## Existing XAMPP database (the tables already exist)

```powershell
npm run db:status
npm run db:baseline -- --through 016_create_office_settings.sql
npm run db:status
```

Baseline verifies the original tables' columns, types, defaults, nullability,
generated consumption expression, required indexes, foreign keys, InnoDB engine,
utf8mb4 charset and office singleton check. Missing/different definitions stop it
with a list of differences. Extra indexes and unrelated tables are allowed.
Do not use baseline merely to silence a migration failure.

Baseline creates `schema_migrations` and records the original 16 files together
in one transaction. It does not recreate tables or change business records.
Future migration files remain pending. Run this while the application is stopped
so another tool cannot alter the schema while it is being checked.

## Empty database (local or VPS)

Create the empty database in your database administration tool first:

```sql
CREATE DATABASE water_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Then configure `.env` for that database:

```powershell
npm run db:migrate
npm run db:seed:office
npm run db:status
```

Migrate creates tables in filename order. It refuses untracked existing tables.
The office seed is optional and repeatable; it preserves an existing office row.
Seeds do not run automatically with migrate or baseline.

## Later changes and failures

Add a new numbered SQL file such as `017_add_example_column.sql`; never edit or
rename applied files. SHA-256 checksums detect changes (CRLF and LF are equivalent).
`db:status` is read-only. Other commands use a database advisory lock to prevent
concurrent runs of this runner.

Back up a live database before schema changes. MySQL/MariaDB DDL implicitly commits:
a failed multi-statement migration may have created some tables already. A durable
`running`/`failed` record blocks automatic retry and later migrations. Inspect the
database, repair it to the reviewed intended schema, and reconcile the history
deliberately; there is no automatic reset, drop, rollback or repair command.

All migration SQL is trusted repository code. The CLI enables multiple statements
only for these local files. The future API must use separate connections with
multiple statements disabled and parameterized queries.

## Validation

```powershell
npm test
```

Tests use the Node test runner with no database dependency. They verify migration
ordering, the initial schema contract, checksum/history guards, baseline refusal,
and migration failure tracking using database doubles. They do not substitute for
running migrations and baseline against a disposable MySQL/MariaDB database.

If an execution sandbox blocks child processes, run the same tests in one process
(Node 24 supports this flag):

```powershell
node --test --test-isolation=none
```
