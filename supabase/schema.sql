-- ===========================================
-- MediaDrop Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ===========================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============ TABLES ============

-- Users (extends Supabase Auth)
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null default '',
  avatar_url    text,
  created_at    timestamptz not null default now()
);

-- Projects
create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  status        text not null default 'reviewing'
                  check (status in ('reviewing', 'approved', 'revision')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Files within projects
create table public.files (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  filename      text not null,
  s3_key        text not null,
  file_type     text not null,           -- MIME type: video/mp4, audio/mpeg, image/jpeg
  file_size     bigint not null default 0,
  duration      text,                     -- e.g. "2:34" for video/audio
  version       int not null default 1,
  is_final      boolean not null default false,
  uploaded_at   timestamptz not null default now()
);

-- Comments / Feedback on files
create table public.comments (
  id              uuid primary key default gen_random_uuid(),
  file_id         uuid not null references public.files(id) on delete cascade,
  author_name     text not null default 'Anonymous',
  body            text not null,
  comment_type    text not null default 'feedback'
                    check (comment_type in ('feedback', 'correction', 'error')),
  timestamp_sec   float,                  -- nullable; pinned time for video/audio
  created_at      timestamptz not null default now()
);

-- Share links for projects
create table public.share_links (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  token         text not null unique,     -- short unique token for the URL
  password_hash text,                     -- bcrypt hash; null = open access
  is_active     boolean not null default true,
  expires_at    timestamptz,              -- null = never expires
  created_at    timestamptz not null default now()
);

-- ============ INDEXES ============

create index idx_projects_owner    on public.projects(owner_id);
create index idx_files_project     on public.files(project_id);
create index idx_comments_file     on public.comments(file_id);
create index idx_share_links_token on public.share_links(token);
create index idx_share_links_proj  on public.share_links(project_id);

-- ============ ROW LEVEL SECURITY ============

alter table public.profiles    enable row level security;
alter table public.projects    enable row level security;
alter table public.files       enable row level security;
alter table public.comments    enable row level security;
alter table public.share_links enable row level security;

-- Profiles: users can read/update their own
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Projects: owners have full access
create policy "Owners can do anything with projects"
  on public.projects for all using (auth.uid() = owner_id);

-- Files: project owners have full access
create policy "Project owners can manage files"
  on public.files for all
  using (
    exists (
      select 1 from public.projects
      where projects.id = files.project_id
        and projects.owner_id = auth.uid()
    )
  );

-- Files: anyone with valid share link can view
create policy "Share link holders can view files"
  on public.files for select
  using (
    exists (
      select 1 from public.share_links sl
      where sl.project_id = files.project_id
        and sl.is_active = true
        and (sl.expires_at is null or sl.expires_at > now())
    )
  );

-- Comments: anyone can insert (reviewers don't need accounts)
create policy "Anyone can add comments via share link"
  on public.comments for insert
  with check (true);

-- Comments: viewable by project owner or share link holder
create policy "Comments viewable by owner"
  on public.comments for select
  using (
    exists (
      select 1 from public.files f
      join public.projects p on p.id = f.project_id
      where f.id = comments.file_id
        and p.owner_id = auth.uid()
    )
  );

create policy "Comments viewable via share link"
  on public.comments for select
  using (
    exists (
      select 1 from public.files f
      join public.share_links sl on sl.project_id = f.project_id
      where f.id = comments.file_id
        and sl.is_active = true
        and (sl.expires_at is null or sl.expires_at > now())
    )
  );

-- Share links: owners can manage
create policy "Owners can manage share links"
  on public.share_links for all
  using (
    exists (
      select 1 from public.projects
      where projects.id = share_links.project_id
        and projects.owner_id = auth.uid()
    )
  );

-- Share links: anyone can read active links (needed for validation)
create policy "Anyone can validate share links"
  on public.share_links for select
  using (is_active = true);

-- ============ REALTIME ============
-- Enable realtime for comments (so reviewers see each other's feedback live)

alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.files;
alter publication supabase_realtime add table public.projects;

-- ============ AUTO-UPDATE TIMESTAMPS ============

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at
  before update on public.projects
  for each row execute function update_updated_at();

-- ============ AUTO-CREATE PROFILE ON SIGNUP ============

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
