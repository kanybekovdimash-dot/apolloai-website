create extension if not exists pgcrypto;

create table if not exists public.chat_leads (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  brand text,
  child_name text,
  child_age text,
  city text,
  parent_name text,
  phone text,
  experience text,
  note text,
  source text default 'ai-chat',
  created_at timestamptz not null default now()
);

create table if not exists public.project_applications (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  project_title text not null,
  role_id text not null,
  role_title text not null,
  full_name text not null,
  age text not null,
  city text not null,
  parent_name text not null,
  phone text not null,
  portfolio_url text,
  experience text,
  note text not null,
  status text not null default 'new',
  source text default 'site',
  created_at timestamptz not null default now()
);

create table if not exists public.video_submissions (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  file_name text not null,
  file_size bigint not null,
  content_type text,
  storage_bucket text not null,
  storage_path text not null unique,
  status text not null default 'uploaded',
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_leads_created_at on public.chat_leads (created_at desc);
create index if not exists idx_project_applications_created_at on public.project_applications (created_at desc);
create index if not exists idx_project_applications_project_id on public.project_applications (project_id);
create index if not exists idx_video_submissions_created_at on public.video_submissions (created_at desc);

alter table public.chat_leads enable row level security;
alter table public.project_applications enable row level security;
alter table public.video_submissions enable row level security;


create table if not exists public.projects_catalog (
  id text primary key,
  title text not null,
  genre text,
  poster text,
  banner text,
  promo_video_url text,
  countdown_date timestamptz,
  description text,
  director text,
  age_range text,
  roles jsonb not null default '[]'::jsonb,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_catalog_published on public.projects_catalog (is_published);
create index if not exists idx_projects_catalog_countdown_date on public.projects_catalog (countdown_date asc);

alter table public.projects_catalog enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'casting-videos',
  'casting-videos',
  false,
  52428800,
  array['video/webm', 'video/mp4', 'video/quicktime']
)
on conflict (id) do nothing;

-- Worker requests use the Supabase service role key, so no public policies are required here.


create table if not exists public.ai_settings (
  id text primary key,
  public_brand text,
  assistant_brand text,
  faq_age text,
  faq_process text,
  faq_generic text,
  system_prompt_override text,
  updated_at timestamptz not null default now()
);

alter table public.ai_settings enable row level security;

insert into public.ai_settings (
  id,
  public_brand,
  assistant_brand,
  faq_age,
  faq_process,
  faq_generic,
  system_prompt_override
)
values (
  'default',
  'Meyram Cinema',
  'Meyram AI',
  'Кастингке негізінен 4-18 жас аралығындағы балалар қатыса алады. Егер бала сәл кіші немесе үлкен болса, бәрібір өтінім қалдыруға болады — менеджер нақтылайды.',
  'Жазылу оңай: AI-көмекші қысқа анкета толтырады, содан кейін өтінімді кастинг жүйесіне сақтайды.',
  'Мен кастингке жазылуға немесе жас, формат және келесі қадам туралы кеңес беруге көмектесе аламын.',
  null
)
on conflict (id) do nothing;
