-- Billing scaffolding, Stripe-ready but live before any Stripe account exists.
-- Identity is email (what the app's sessions use today); stripe_* columns stay
-- null until Stripe is connected, so no schema change is needed to turn it on.
-- Plans and prices per the GTM pricing note: Analyst $150/mo, Desk $1,500/mo (5 seats).

create table billing_customers (
  email text primary key,
  stripe_customer_id text unique,   -- null until Stripe is connected
  created_at timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null references billing_customers(email) on delete cascade,
  plan text not null check (plan in ('analyst', 'desk')),
  status text not null default 'preview'
    check (status in ('preview', 'trialing', 'active', 'past_due', 'canceled')),
  stripe_subscription_id text unique,
  seats int not null default 1 check (seats >= 1),
  started_at timestamptz not null default now(),
  canceled_at timestamptz
);

create index subscriptions_email on subscriptions(email);

alter table billing_customers enable row level security;
alter table subscriptions enable row level security;
-- No anon policies on billing: service-role access only.
