# MuAlim.Api — ASP.NET Core Web API + Swagger

> **VS Code колдонуучулары үчүн:** .NET SDK орнотулганча Swagger'ди Node API аркылуу көрсөңүз болот (төмөндө).

## Азыр иштейт (VS Code + Node) — `.NET` керек эмес

```bash
npm run dev:server
```

Браузерде ачыңыз: **http://localhost:3001/api-docs**

Эгер «Доступ к localhost запрещен» чыкса — сервер иштеп жатпайт. Алгач терминалда команда иштетиңиз.

VS Code: **Run and Debug** → **Node API (Swagger)** → F5

---

## .NET API (MuAlim.Api) — кийинчерээк

Visual Studio эмес, **VS Code** менен иштейт. Бирок алгач **.NET 8 SDK** орнотуу керек:

https://dotnet.microsoft.com/download/dotnet/8.0

Орноткондон кийин:

```bash
cd MuAlim.Api
dotnet restore
dotnet run
```

Swagger: **http://localhost:5000/swagger**

VS Code: **Run and Debug** → **MuAlim.Api (Swagger)** → F5

---

## Connection string

`MuAlim.Api/appsettings.json`:

```
Host=localhost;Port=5433;Database=mualim;Username=postgres;Password=1234
```

Node API `.env` файлын колдонот:

```
DATABASE_URL="postgresql://postgres:1234@localhost:5433/mualim?schema=public"
```

## API endpointter

| Method | URL | Auth |
|---|---|---|
| GET | `/api/health` | — |
| POST | `/api/auth/login` | — |
| GET | `/api/qa` | — |
| GET | `/api/qa/{slug}` | — |
| POST | `/api/qa` | Admin |
| PUT | `/api/qa/{id}` | Admin |
| DELETE | `/api/qa/{id}` | Admin |
