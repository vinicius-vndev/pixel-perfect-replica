
create extension if not exists btree_gist;

-- ENUMS
create type public.member_role as enum ('owner','staff');
create type public.appointment_status as enum ('pendente','confirmado','recusado','cancelado','concluido','nao_compareceu');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- BUSINESSES
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 60),
  name text not null check (length(name) between 2 and 120),
  description text check (length(description) <= 2000),
  phone text,
  whatsapp text,
  address text,
  logo_url text,
  cover_url text,
  timezone text not null default 'America/Sao_Paulo',
  slot_interval_minutes int not null default 30 check (slot_interval_minutes in (15,30,60)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.businesses to anon;
grant select, update on public.businesses to authenticated;
grant all on public.businesses to service_role;
alter table public.businesses enable row level security;

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null,
  role public.member_role not null default 'owner',
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);
create index on public.business_members(user_id);
grant select on public.business_members to authenticated;
grant all on public.business_members to service_role;
alter table public.business_members enable row level security;
create policy "members see own memberships" on public.business_members for select to authenticated using (user_id = auth.uid());

create or replace function public.is_business_member(_business_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.business_members where business_id = _business_id and user_id = auth.uid())
$$;

create policy "public read businesses" on public.businesses for select to anon, authenticated using (true);
create policy "members update business" on public.businesses for update to authenticated
  using (public.is_business_member(id)) with check (public.is_business_member(id));

-- SERVICES
create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(name) between 2 and 120),
  description text check (length(description) <= 1000),
  price_cents integer not null check (price_cents >= 0),
  duration_minutes integer not null check (duration_minutes between 15 and 720),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);
create index on public.services(business_id, is_active);
grant select on public.services to anon;
grant select, insert, update on public.services to authenticated;
grant all on public.services to service_role;
alter table public.services enable row level security;
create policy "public read active services" on public.services for select to anon, authenticated using (is_active or public.is_business_member(business_id));
create policy "members insert services" on public.services for insert to authenticated with check (public.is_business_member(business_id));
create policy "members update services" on public.services for update to authenticated using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

-- BUSINESS HOURS
create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  is_open boolean not null default true,
  open_time time not null default '08:00',
  close_time time not null default '18:00',
  break_start time,
  break_end time,
  unique (business_id, weekday),
  check (close_time > open_time),
  check ((break_start is null and break_end is null) or (break_start is not null and break_end is not null and break_end > break_start))
);
grant select on public.business_hours to anon;
grant select, insert, update, delete on public.business_hours to authenticated;
grant all on public.business_hours to service_role;
alter table public.business_hours enable row level security;
create policy "public read hours" on public.business_hours for select to anon, authenticated using (true);
create policy "members write hours" on public.business_hours for all to authenticated using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

-- SCHEDULE BLOCKS
create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on public.schedule_blocks(business_id, starts_at);
grant select, insert, update, delete on public.schedule_blocks to authenticated;
grant all on public.schedule_blocks to service_role;
alter table public.schedule_blocks enable row level security;
create policy "members manage blocks" on public.schedule_blocks for all to authenticated using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

-- CUSTOMERS
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  phone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, phone),
  unique (id, business_id)
);
create index on public.customers(business_id, name);
grant select, update on public.customers to authenticated;
grant all on public.customers to service_role;
alter table public.customers enable row level security;
create policy "members read customers" on public.customers for select to authenticated using (public.is_business_member(business_id));
create policy "members update customers" on public.customers for update to authenticated using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

-- VEHICLES
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null,
  model text not null,
  plate text,
  created_at timestamptz not null default now(),
  foreign key (customer_id, business_id) references public.customers(id, business_id) on delete cascade,
  unique (id, business_id)
);
create index on public.vehicles(customer_id);
grant select on public.vehicles to authenticated;
grant all on public.vehicles to service_role;
alter table public.vehicles enable row level security;
create policy "members read vehicles" on public.vehicles for select to authenticated using (public.is_business_member(business_id));

-- APPOINTMENTS
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null,
  vehicle_id uuid,
  service_id uuid not null,
  service_name text not null,
  price_cents integer not null,
  duration_minutes integer not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'pendente',
  notes text check (length(notes) <= 1000),
  request_key uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (customer_id, business_id) references public.customers(id, business_id),
  foreign key (vehicle_id, business_id) references public.vehicles(id, business_id),
  foreign key (service_id, business_id) references public.services(id, business_id),
  unique (business_id, request_key),
  check (ends_at > starts_at),
  constraint appointments_no_overlap exclude using gist (
    business_id with =, tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pendente','confirmado'))
);
create index on public.appointments(business_id, starts_at);
create index on public.appointments(business_id, status);
create index on public.appointments(customer_id);
grant select on public.appointments to authenticated;
grant all on public.appointments to service_role;
alter table public.appointments enable row level security;
create policy "members read appointments" on public.appointments for select to authenticated using (public.is_business_member(business_id));

create table public.appointment_status_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  old_status public.appointment_status,
  new_status public.appointment_status not null,
  changed_by uuid,
  changed_by_label text,
  changed_at timestamptz not null default now()
);
create index on public.appointment_status_history(appointment_id);
grant select on public.appointment_status_history to authenticated;
grant all on public.appointment_status_history to service_role;
alter table public.appointment_status_history enable row level security;
create policy "members read history" on public.appointment_status_history for select to authenticated using (public.is_business_member(business_id));

-- updated_at trigger
create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
create trigger t_profiles before update on public.profiles for each row execute function public.touch_updated_at();
create trigger t_businesses before update on public.businesses for each row execute function public.touch_updated_at();
create trigger t_services before update on public.services for each row execute function public.touch_updated_at();
create trigger t_customers before update on public.customers for each row execute function public.touch_updated_at();
create trigger t_appointments before update on public.appointments for each row execute function public.touch_updated_at();

-- prevent changing business_id of services
create or replace function public.lock_service_business() returns trigger language plpgsql set search_path = public as $$
begin if new.business_id <> old.business_id then raise exception 'Não é permitido mover serviço'; end if; return new; end $$;
create trigger t_lock_service before update on public.services for each row execute function public.lock_service_business();

-- PHONE NORMALIZATION
create or replace function public.normalize_phone(_p text) returns text language sql immutable set search_path = public as $$
  select case
    when length(regexp_replace(coalesce(_p,''), '\D', '', 'g')) in (10,11) then '55' || regexp_replace(_p, '\D', '', 'g')
    else regexp_replace(coalesce(_p,''), '\D', '', 'g') end
$$;

-- CREATE BUSINESS (onboarding)
create or replace function public.create_business(_name text, _slug text) returns uuid
language plpgsql security definer set search_path = public as $$
declare _id uuid; _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'Não autenticado'; end if;
  if exists (select 1 from business_members where user_id = _uid) then raise exception 'Você já possui uma estética cadastrada'; end if;
  insert into businesses (name, slug) values (trim(_name), lower(trim(_slug))) returning id into _id;
  insert into business_members (business_id, user_id, role) values (_id, _uid, 'owner');
  insert into business_hours (business_id, weekday, is_open, open_time, close_time)
  select _id, d, d between 1 and 6, '08:00', case when d = 6 then '13:00'::time else '18:00'::time end from generate_series(0,6) d;
  return _id;
end $$;
revoke all on function public.create_business(text,text) from public, anon;
grant execute on function public.create_business(text,text) to authenticated;

-- SLOT VALIDATION (internal)
create or replace function public._slot_is_free(_business_id uuid, _start timestamptz, _end timestamptz) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare _tz text; _local_start timestamp; _local_end timestamp; _h business_hours;
begin
  select timezone into _tz from businesses where id = _business_id;
  _local_start := _start at time zone _tz;
  _local_end := _end at time zone _tz;
  if _start < now() then return false; end if;
  if _local_start::date <> (_local_end - interval '1 second')::date then return false; end if;
  select * into _h from business_hours where business_id = _business_id and weekday = extract(dow from _local_start)::int;
  if not found or not _h.is_open then return false; end if;
  if _local_start::time < _h.open_time or _local_end::time > _h.close_time or (_local_end::time = '00:00' and _h.close_time <> '00:00') then return false; end if;
  if _h.break_start is not null and _local_start::time < _h.break_end and _local_end::time > _h.break_start then return false; end if;
  if exists (select 1 from schedule_blocks b where b.business_id = _business_id and tstzrange(b.starts_at,b.ends_at) && tstzrange(_start,_end)) then return false; end if;
  if exists (select 1 from appointments a where a.business_id = _business_id and a.status in ('pendente','confirmado') and tstzrange(a.starts_at,a.ends_at) && tstzrange(_start,_end)) then return false; end if;
  return true;
end $$;
revoke all on function public._slot_is_free(uuid,timestamptz,timestamptz) from public, anon, authenticated;

-- AVAILABLE SLOTS (public, returns only free start times)
create or replace function public.get_available_slots(_slug text, _service_id uuid, _date date) returns setof timestamptz
language plpgsql stable security definer set search_path = public as $$
declare _b businesses; _s services; _h business_hours; _t timestamp; _start timestamptz;
begin
  select * into _b from businesses where slug = _slug;
  if not found then return; end if;
  select * into _s from services where id = _service_id and business_id = _b.id and is_active;
  if not found then return; end if;
  if _date > (now() at time zone _b.timezone)::date + 90 then return; end if;
  select * into _h from business_hours where business_id = _b.id and weekday = extract(dow from _date)::int;
  if not found or not _h.is_open then return; end if;
  _t := _date + _h.open_time;
  while _t + make_interval(mins => _s.duration_minutes) <= _date + _h.close_time loop
    _start := _t at time zone _b.timezone;
    if public._slot_is_free(_b.id, _start, _start + make_interval(mins => _s.duration_minutes)) then
      return next _start;
    end if;
    _t := _t + make_interval(mins => _b.slot_interval_minutes);
  end loop;
end $$;
grant execute on function public.get_available_slots(text,uuid,date) to anon, authenticated;

-- CREATE BOOKING REQUEST (public)
create or replace function public.create_booking_request(
  _slug text, _service_id uuid, _starts_at timestamptz, _name text, _phone text,
  _vehicle_model text, _plate text, _notes text, _request_key uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare _b businesses; _s services; _phone_n text; _cust uuid; _veh uuid; _appt uuid; _end timestamptz; _plate_n text;
begin
  select * into _b from businesses where slug = _slug;
  if not found then raise exception 'ESTETICA_NAO_ENCONTRADA'; end if;
  if _request_key is null then raise exception 'DADOS_INVALIDOS'; end if;

  select id into _appt from appointments where business_id = _b.id and request_key = _request_key;
  if found then return _appt; end if;

  select * into _s from services where id = _service_id and business_id = _b.id and is_active;
  if not found then raise exception 'SERVICO_INDISPONIVEL'; end if;

  _name := trim(coalesce(_name,''));
  _vehicle_model := trim(coalesce(_vehicle_model,''));
  _phone_n := public.normalize_phone(_phone);
  _plate_n := nullif(upper(regexp_replace(coalesce(_plate,''), '[^A-Za-z0-9]', '', 'g')), '');
  if length(_name) < 2 or length(_name) > 120 then raise exception 'NOME_INVALIDO'; end if;
  if length(_phone_n) < 12 or length(_phone_n) > 15 then raise exception 'TELEFONE_INVALIDO'; end if;
  if length(_vehicle_model) < 2 or length(_vehicle_model) > 80 then raise exception 'VEICULO_INVALIDO'; end if;
  if _plate_n is not null and length(_plate_n) > 10 then raise exception 'PLACA_INVALIDA'; end if;
  if length(coalesce(_notes,'')) > 1000 then raise exception 'OBSERVACAO_LONGA'; end if;

  -- rate limit: max 3 pending requests per phone per business and 30 requests/hour per business
  if (select count(*) from appointments a join customers c on c.id = a.customer_id
      where a.business_id = _b.id and c.phone = _phone_n and a.status = 'pendente' and a.starts_at > now()) >= 3 then
    raise exception 'LIMITE_SOLICITACOES';
  end if;
  if (select count(*) from appointments where business_id = _b.id and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'LIMITE_SOLICITACOES';
  end if;

  _end := _starts_at + make_interval(mins => _s.duration_minutes);
  if not public._slot_is_free(_b.id, _starts_at, _end) then raise exception 'HORARIO_INDISPONIVEL'; end if;
  -- slot must align with interval grid
  if extract(epoch from (_starts_at at time zone _b.timezone)::time)::int % (_b.slot_interval_minutes*60) <> 0 then
    raise exception 'HORARIO_INDISPONIVEL';
  end if;

  insert into customers (business_id, name, phone) values (_b.id, _name, _phone_n)
  on conflict (business_id, phone) do update set name = excluded.name
  returning id into _cust;

  select id into _veh from vehicles where customer_id = _cust and lower(model) = lower(_vehicle_model)
    and coalesce(plate,'') = coalesce(_plate_n,'') limit 1;
  if _veh is null then
    insert into vehicles (business_id, customer_id, model, plate) values (_b.id, _cust, _vehicle_model, _plate_n) returning id into _veh;
  end if;

  begin
    insert into appointments (business_id, customer_id, vehicle_id, service_id, service_name, price_cents, duration_minutes,
      starts_at, ends_at, status, notes, request_key)
    values (_b.id, _cust, _veh, _s.id, _s.name, _s.price_cents, _s.duration_minutes, _starts_at, _end, 'pendente',
      nullif(trim(coalesce(_notes,'')),''), _request_key)
    returning id into _appt;
  exception
    when exclusion_violation then raise exception 'HORARIO_INDISPONIVEL';
    when unique_violation then
      select id into _appt from appointments where business_id = _b.id and request_key = _request_key;
      if _appt is null then raise; end if;
      return _appt;
  end;

  insert into appointment_status_history (appointment_id, business_id, old_status, new_status, changed_by, changed_by_label)
  values (_appt, _b.id, null, 'pendente', null, 'Cliente (página pública)');
  return _appt;
end $$;
grant execute on function public.create_booking_request(text,uuid,timestamptz,text,text,text,text,text,uuid) to anon, authenticated;

-- CHANGE STATUS (owner)
create or replace function public.change_appointment_status(_appointment_id uuid, _new_status public.appointment_status) returns void
language plpgsql security definer set search_path = public as $$
declare _a appointments; _uid uuid := auth.uid(); _label text;
begin
  if _uid is null then raise exception 'Não autenticado'; end if;
  select * into _a from appointments where id = _appointment_id for update;
  if not found then raise exception 'Agendamento não encontrado'; end if;
  if not exists (select 1 from business_members where business_id = _a.business_id and user_id = _uid) then
    raise exception 'Sem permissão';
  end if;
  if not (
    (_a.status = 'pendente' and _new_status in ('confirmado','recusado','cancelado')) or
    (_a.status = 'confirmado' and _new_status in ('concluido','cancelado','nao_compareceu'))
  ) then
    raise exception 'Transição de status inválida: % → %', _a.status, _new_status;
  end if;
  update appointments set status = _new_status where id = _a.id;
  select coalesce(full_name, (select email from auth.users where id = _uid)) into _label from profiles where id = _uid;
  insert into appointment_status_history (appointment_id, business_id, old_status, new_status, changed_by, changed_by_label)
  values (_a.id, _a.business_id, _a.status, _new_status, _uid, _label);
end $$;
revoke all on function public.change_appointment_status(uuid, public.appointment_status) from public, anon;
grant execute on function public.change_appointment_status(uuid, public.appointment_status) to authenticated;

-- STORAGE policies for business-media bucket: path = <business_id>/<file>
create policy "media public read" on storage.objects for select to anon, authenticated using (bucket_id = 'business-media');
create policy "media member insert" on storage.objects for insert to authenticated with check (
  bucket_id = 'business-media' and public.is_business_member(((storage.foldername(name))[1])::uuid)
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp'));
create policy "media member update" on storage.objects for update to authenticated using (
  bucket_id = 'business-media' and public.is_business_member(((storage.foldername(name))[1])::uuid));
create policy "media member delete" on storage.objects for delete to authenticated using (
  bucket_id = 'business-media' and public.is_business_member(((storage.foldername(name))[1])::uuid));
