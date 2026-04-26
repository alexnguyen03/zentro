\set ON_ERROR_STOP on
\if :{?row_count}
\else
\set row_count 100000
\endif

CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.app_meta (
    meta_key text PRIMARY KEY,
    meta_value text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.app_meta (meta_key, meta_value)
VALUES
    ('environment', :'env_key'),
    ('database', :'db_name'),
    ('bootstrap_version', 'v1')
ON CONFLICT (meta_key)
DO UPDATE SET
    meta_value = EXCLUDED.meta_value,
    updated_at = now();

CREATE TABLE IF NOT EXISTS app.accounts (
    account_id serial PRIMARY KEY,
    email text NOT NULL UNIQUE,
    full_name text NOT NULL,
    env_tag text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.orders (
    order_id serial PRIMARY KEY,
    account_id int NOT NULL REFERENCES app.accounts(account_id) ON DELETE CASCADE,
    order_no text NOT NULL UNIQUE,
    amount numeric(12,2) NOT NULL CHECK (amount >= 0),
    status text NOT NULL CHECK (status IN ('new', 'paid', 'cancelled')),
    env_tag text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

DELETE FROM app.orders WHERE env_tag = :'env_key';
DELETE FROM app.accounts WHERE env_tag = :'env_key';

INSERT INTO app.accounts (email, full_name, env_tag, created_at)
SELECT
    'user' || lpad(gs.n::text, 6, '0') || '+' || :'env_key' || '@local.test' AS email,
    'User ' || upper(:'env_key') || ' ' || lpad(gs.n::text, 6, '0') AS full_name,
    :'env_key' AS env_tag,
    now() - ((gs.n % 10080)::text || ' minutes')::interval
FROM generate_series(1, :row_count) AS gs(n)
ON CONFLICT (email)
DO UPDATE SET
    full_name = EXCLUDED.full_name,
    env_tag = EXCLUDED.env_tag,
    created_at = EXCLUDED.created_at;

INSERT INTO app.orders (account_id, order_no, amount, status, env_tag, created_at)
SELECT
    a.account_id,
    'ORD-' || upper(:'env_key') || '-' || lpad(gs.n::text, 8, '0') AS order_no,
    round((((gs.n % 5000) + 100)::numeric / 7), 2) AS amount,
    CASE
        WHEN gs.n % 10 < 5 THEN 'new'
        WHEN gs.n % 10 < 8 THEN 'paid'
        ELSE 'cancelled'
    END AS status,
    :'env_key' AS env_tag,
    now() - ((gs.n % 43200)::text || ' minutes')::interval
FROM generate_series(1, :row_count) AS gs(n)
JOIN app.accounts a ON a.email = 'user' || lpad(gs.n::text, 6, '0') || '+' || :'env_key' || '@local.test'
ON CONFLICT (order_no)
DO UPDATE SET
    amount = EXCLUDED.amount,
    status = EXCLUDED.status,
    env_tag = EXCLUDED.env_tag,
    created_at = EXCLUDED.created_at;

CREATE INDEX IF NOT EXISTS idx_orders_status ON app.orders(status);

CREATE OR REPLACE VIEW app.v_open_orders AS
SELECT
    o.order_id,
    o.order_no,
    o.amount,
    o.status,
    a.full_name AS customer_name,
    o.env_tag,
    o.created_at
FROM app.orders o
JOIN app.accounts a ON a.account_id = o.account_id
WHERE o.status = 'new';

GRANT USAGE ON SCHEMA app TO :"app_user";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO :"app_user";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO :"app_user";
