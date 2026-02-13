-- Create a table for user preferences
create table if not exists user_preferences (
  user_id uuid references auth.users not null primary key,
  timezone text default 'UTC',
  work_start_time time default '09:00',
  work_end_time time default '17:00',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for user_preferences
alter table user_preferences enable row level security;

create policy "Users can view their own preferences"
  on user_preferences for select
  using ( auth.uid() = user_id );

create policy "Users can update their own preferences"
  on user_preferences for insert
  with check ( auth.uid() = user_id );

create policy "Users can update their own preferences"
  on user_preferences for update
  using ( auth.uid() = user_id );

-- Create a table for chat sessions
create table if not exists chats (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for chats
alter table chats enable row level security;

create policy "Users can view their own chats"
  on chats for select
  using ( auth.uid() = user_id );

create policy "Users can create their own chats"
  on chats for insert
  with check ( auth.uid() = user_id );

create policy "Users can delete their own chats"
  on chats for delete
  using ( auth.uid() = user_id );

-- Create a table for messages
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  chat_id uuid references chats(id) on delete cascade not null,
  role text not null, -- 'user', 'assistant', 'system'
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for messages
alter table messages enable row level security;

create policy "Users can view messages from their chats"
  on messages for select
  using ( exists ( select 1 from chats where chats.id = messages.chat_id and chats.user_id = auth.uid() ) );

create policy "Users can create messages in their chats"
  on messages for insert
  with check ( exists ( select 1 from chats where chats.id = messages.chat_id and chats.user_id = auth.uid() ) );
