// Minimal dependencies outside the real quote/invoice migrations.
export const quoteRecipePrerequisites = `CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE user_roles(user_id uuid,role text);
    CREATE TABLE marketplace_binders(id uuid PRIMARY KEY);
    CREATE TABLE marketplace_binder_members(binder_id uuid,user_id uuid,account_status text);
    CREATE TABLE marketplace_cases(id uuid PRIMARY KEY,acquisition_origin text,referred_binder_id uuid);
    CREATE TABLE marketplace_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid,actor_user_id uuid,event_type text,metadata jsonb);
    CREATE TABLE marketplace_commercial_proposals(id uuid PRIMARY KEY,case_id uuid,status text,accepted_at timestamptz);
    CREATE FUNCTION build_touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[],created_at timestamptz DEFAULT now());
    CREATE TABLE storage.objects(id uuid,bucket_id text,name text);
  `;
