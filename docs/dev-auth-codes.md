# Auth codes in local development

Registration and password-reset codes are sent by email only. For local development and QA, the API can run without a real mailbox. In that mode no code is ever written to the server log.

## 1. Run the API with `MAIL_TRANSPORT=log`

In your local `.env` (never on a server):

```
NODE_ENV=development
MAIL_TRANSPORT=log
```

- Nothing is emailed. The log shows only `[auth-code] MAIL_TRANSPORT=log — … code not emailed`, without the code or the address.
- The API refuses to start with `MAIL_TRANSPORT=log` when `NODE_ENV=production`.

## 2. Read the code from your local database

Codes live in `password_reset_tokens`. A code is live while `used_at` is empty and `expires_at` is in the future (15 minutes). Each new code cancels the user's older ones.

```sql
SELECT t.token AS code, t.purpose, t.expires_at
FROM password_reset_tokens t
JOIN users u ON u.id = t.user_id
WHERE lower(u.email) = lower('you@test.local')
  AND t.used_at IS NULL
  AND t.expires_at > now()
ORDER BY t.created_at DESC
LIMIT 1;
```

`purpose` is `register` for `/api/auth/confirm-code` and `reset` for `/api/auth/reset-password`. A code works only for its own purpose.

## Safety rules

- Run this query only against your **local or disposable test database**, never production. The query is read-only; do not change tokens by hand.
- Use test addresses such as `@test.local`. Never put real users' addresses into a dev database.
- Do not paste codes into tickets, chats or logs. A live code is enough to take over the account.
