-- SkillMatchPH Administrator Account Setup Script
--
-- Account details to be created/updated:
--   First Name : skill
--   Last Name  : match
--   Username   : skillmatchph
--   Work Email : skillmatchph76@gmail.com
--   Password   : 12345678
--   Role       : admin
--   Status     : approved
--
-- How to run:
-- 1. Open your Supabase Project Dashboard (https://supabase.com/dashboard).
-- 2. Go to SQL Editor.
-- 3. Paste and run this script.
-- 4. You can immediately sign in at http://localhost:5173 with:
--      Username: skillmatchph
--      Password: 12345678

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  target_email text := 'skillmatchph76@gmail.com';
  target_password text := '12345678';
  target_username text := 'skillmatchph';
  target_first_name text := 'skill';
  target_last_name text := 'match';
  target_user_id uuid;
  encrypted_pw text;
begin
  -- Resolve crypt/gen_salt across extensions and public schemas
  set search_path = public, extensions, auth;

  encrypted_pw := crypt(target_password, gen_salt('bf'));

  -- 1. Free up target username if taken by another user
  update public.profiles
  set username = 'skillmatch_' || left(replace(id::text, '-', ''), 8)
  where lower(username) = lower(target_username)
    and id not in (
      select id from auth.users where lower(email) = lower(target_email)
    );

  -- 2. Temporarily disable triggers that would enforce student defaults or block admin updates
  if exists (
    select 1 from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname = 'on_auth_user_created'
      and not tgisinternal
  ) then
    alter table auth.users disable trigger on_auth_user_created;
  end if;

  if exists (
    select 1 from pg_trigger
    where tgrelid = 'public.profiles'::regclass
      and tgname = 'profiles_protect_system_fields'
      and not tgisinternal
  ) then
    alter table public.profiles disable trigger profiles_protect_system_fields;
  end if;

  -- 3. Check if account already exists in auth.users
  select id into target_user_id
  from auth.users
  where lower(email) = lower(target_email)
  limit 1;

  if target_user_id is not null then
    -- Existing user: update credentials, confirm email, and refresh metadata
    update auth.users
    set encrypted_password = encrypted_pw,
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        confirmed_at = coalesce(confirmed_at, now()),
        raw_app_meta_data = jsonb_set(coalesce(raw_app_meta_data, '{}'::jsonb), '{provider}', '"email"'),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
          'first_name', target_first_name,
          'last_name', target_last_name,
          'username', target_username
        ),
        updated_at = now()
    where id = target_user_id;
  else
    -- New user: create in auth.users
    target_user_id := gen_random_uuid();

    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) values (
      target_user_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'authenticated',
      'authenticated',
      target_email,
      encrypted_pw,
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'first_name', target_first_name,
        'last_name', target_last_name,
        'username', target_username
      ),
      now(),
      now()
    );
  end if;

  -- 4. Ensure an email identity exists in auth.identities if the table exists
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'auth' and table_name = 'identities'
  ) then
    if not exists (
      select 1 from auth.identities
      where user_id = target_user_id and provider = 'email'
    ) then
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'auth' and table_name = 'identities' and column_name = 'provider_id'
      ) then
        insert into auth.identities (
          id,
          user_id,
          identity_data,
          provider,
          provider_id,
          last_sign_in_at,
          created_at,
          updated_at
        ) values (
          target_user_id::text,
          target_user_id,
          jsonb_build_object('sub', target_user_id::text, 'email', target_email),
          'email',
          target_email,
          now(),
          now(),
          now()
        );
      else
        insert into auth.identities (
          id,
          user_id,
          identity_data,
          provider,
          last_sign_in_at,
          created_at,
          updated_at
        ) values (
          target_user_id::text,
          target_user_id,
          jsonb_build_object('sub', target_user_id::text, 'email', target_email),
          'email',
          now(),
          now(),
          now()
        );
      end if;
    end if;
  end if;

  -- 5. Upsert the profile in public.profiles with administrator role and approved status
  insert into public.profiles (
    id,
    first_name,
    last_name,
    student_no,
    grade_level,
    shs_track,
    shs_strand,
    avatar_path,
    username,
    role,
    status,
    created_at,
    updated_at
  ) values (
    target_user_id,
    target_first_name,
    target_last_name,
    'ADMIN-' || target_user_id::text,
    11,
    'Academic',
    'STEM',
    null,
    target_username,
    'admin',
    'approved',
    now(),
    now()
  )
  on conflict (id) do update set
    first_name = target_first_name,
    last_name = target_last_name,
    student_no = coalesce(public.profiles.student_no, 'ADMIN-' || target_user_id::text),
    grade_level = coalesce(public.profiles.grade_level, 11),
    shs_track = coalesce(public.profiles.shs_track, 'Academic'),
    shs_strand = coalesce(public.profiles.shs_strand, 'STEM'),
    username = target_username,
    role = 'admin',
    status = 'approved',
    updated_at = now();

  -- 6. Re-enable the disabled triggers
  if exists (
    select 1 from pg_trigger
    where tgrelid = 'public.profiles'::regclass
      and tgname = 'profiles_protect_system_fields'
      and not tgisinternal
  ) then
    alter table public.profiles enable trigger profiles_protect_system_fields;
  end if;

  if exists (
    select 1 from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname = 'on_auth_user_created'
      and not tgisinternal
  ) then
    alter table auth.users enable trigger on_auth_user_created;
  end if;

  raise notice 'Administrator account % (%) successfully configured with role=admin and status=approved!', target_username, target_email;
end;
$$;

