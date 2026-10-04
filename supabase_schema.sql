create table if not exists public.authors (
    id text primary key,
    name text not null,
    handle text not null,
    avatar_color text default 'linear-gradient(135deg, #0080ff, #26c6da)',
    avatar_text text,
    badge text,
    bio text,
    verified boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.posts (
    id text primary key,
    correct_author_id text references public.authors(id) on delete cascade,
    post_text text,
    screenshot text not null, 
    hint text,
    difficulty text default 'normal',
    tags text[] default array[]::text[],
    likes int default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.leaderboard (
    id uuid default gen_random_uuid() primary key,
    nickname text not null,
    score int not null default 0,
    streak int not null default 0,
    accuracy int not null default 0,
    mode text not null default 'blitz',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.suggestions_posts (
    id uuid default gen_random_uuid() primary key,
    author_id text,
    author_name text,
    screenshot text not null,
    post_text text,
    submitted_by text default 'Аноним',
    status text default 'pending', 
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.suggestions_authors (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    handle text not null,
    bio text,
    submitted_by text default 'Аноним',
    status text default 'pending',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_leaderboard_score on public.leaderboard (score desc);
create index if not exists idx_posts_author on public.posts (correct_author_id);
create index if not exists idx_authors_name on public.authors (name);

alter table public.authors enable row level security;
alter table public.posts enable row level security;
alter table public.leaderboard enable row level security;
alter table public.suggestions_posts enable row level security;
alter table public.suggestions_authors enable row level security;

create policy "Allow public read authors" on public.authors for select using (true);
create policy "Allow public insert authors" on public.authors for insert with check (true);
create policy "Allow public update authors" on public.authors for update using (true);

create policy "Allow public read posts" on public.posts for select using (true);
create policy "Allow public insert posts" on public.posts for insert with check (true);
create policy "Allow public delete posts" on public.posts for delete using (true);

create policy "Allow public read leaderboard" on public.leaderboard for select using (true);
create policy "Allow public insert leaderboard" on public.leaderboard for insert with check (true);

create policy "Allow public insert suggested posts" on public.suggestions_posts for insert with check (true);
create policy "Allow public read suggested posts" on public.suggestions_posts for select using (true);

create policy "Allow public insert suggested authors" on public.suggestions_authors for insert with check (true);
create policy "Allow public read suggested authors" on public.suggestions_authors for select using (true);
