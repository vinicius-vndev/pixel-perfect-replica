// Run only against an isolated database containing the project's migrations.
// Never set DETAILHUB_TEST_DATABASE_URL to a production database.
// @vitest-environment node
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env["DETAILHUB_TEST_DATABASE_URL"];
const suite = url ? describe : describe.skip;
suite("booking database regressions (isolated PostgreSQL)", () => {
  const sql = postgres(url ?? "", { max: 8 });
  const business = randomUUID();
  const otherBusiness = randomUUID();
  const service = randomUUID();
  const otherService = randomUUID();
  const owner = randomUUID();
  const customer = randomUUID();
  const slug = `test-${business}`;
  const otherSlug = `test-${otherBusiness}`;
  const origin = "a".repeat(64);
  let day: string;
  const at = (time: string, days = 1) => sql`select ((now() at time zone 'America/Sao_Paulo')::date + ${days} + ${time}::time) at time zone 'America/Sao_Paulo' as t`.then((r) => r[0]?.["t"]);
  const book = async (start: Date | null, name = "Outro Nome", key = randomUUID(), s = service) => {
    const r = await sql`select public.create_booking_request(${slug},${s}::uuid,${start},${name},'11987654321','Onix','','',${key}::uuid) as id`;
    return r[0]?.["id"];
  };
  beforeAll(async () => {
    await sql`insert into auth.users(id,email,raw_user_meta_data) values(${owner},'owner@example.test','{}')`;
    await sql`insert into businesses(id,slug,name) values(${business},${slug},'Test A'),(${otherBusiness},${otherSlug},'Test B')`;
    await sql`insert into business_members(business_id,user_id) values(${business},${owner})`;
    await sql`insert into services(id,business_id,name,price_cents,duration_minutes) values(${service},${business},'Lavagem',8000,60),(${otherService},${otherBusiness},'Outro',9000,60)`;
    await sql`insert into customers(id,business_id,name,phone) values(${customer},${business},'Nome Original','5511987654321')`;
    await sql`insert into business_hours(business_id,weekday,open_time,close_time) select ${business}::uuid,d,'08:00'::time,'18:00'::time from generate_series(0,6) d`;
    const r = await sql`select (now() at time zone 'America/Sao_Paulo')::date+1 as d`;
    day = String(r[0]?.["d"]).slice(0, 10);
  });
  afterAll(async () => {
    await sql`delete from appointment_status_history where business_id in (${business},${otherBusiness})`;
    await sql`delete from appointments where business_id in (${business},${otherBusiness})`;
    await sql`delete from vehicles where business_id in (${business},${otherBusiness})`;
    await sql`delete from customers where business_id in (${business},${otherBusiness})`;
    await sql`delete from businesses where id in (${business},${otherBusiness})`;
    await sql`delete from auth.users where id=${owner}`;
    await sql`delete from booking_origin_counters where origin_hash=${origin}`;
    await sql.end();
  });
  it("preserves existing name and records declared identity without changing earlier bookings", async () => {
    const original = await book(await at("08:00"), "Nome Original");
    const next = await book(await at("09:00"));
    const c = await sql`select name from customers where id=${customer}`;
    const a = await sql`select declared_customer_name,price_cents,status from appointments where id=${next}`;
    const old = await sql`select declared_customer_name from appointments where id=${original}`;
    expect(c[0]?.["name"]).toBe("Nome Original");
    expect(old[0]?.["declared_customer_name"]).toBe("Nome Original");
    expect(a[0]?.["declared_customer_name"]).toBe("Outro Nome");
    expect(a[0]?.["price_cents"]).toBe(8000);
    expect(a[0]?.["status"]).toBe("pendente");
  });
  for (const opening of ["08:00", "08:15", "08:10"]) {
    it(`offers and accepts opening-anchored slots at ${opening}`, async () => {
      await sql`update business_hours set open_time=${opening}::time where business_id=${business}`;
      const date = await sql`select ((now() at time zone 'America/Sao_Paulo')::date+2)::text as d`;
      const slots = await sql`select public.get_available_slots(${slug},${service}::uuid,${date[0]?.["d"]}::date) as t`;
      expect(slots.length).toBeGreaterThan(0);
      const start = await at(opening, 2);
      expect(new Date(slots[0]?.["t"]).getTime()).toBe(start.getTime());
      const id = await book(start);
      expect(id).toBeTruthy();
      await sql`delete from appointment_status_history where appointment_id=${id}`;
      await sql`delete from appointments where id=${id}`;
    });
  }
  it("rejects off-grid starts and honors breaks, blocks and duration", async () => {
    await sql`update business_hours set open_time='08:15',break_start='12:00',break_end='13:00' where business_id=${business}`;
    await expect(book(await at("08:30", 3))).rejects.toThrow("HORARIO_INDISPONIVEL");
    await expect(book(await at("11:45", 3))).rejects.toThrow("HORARIO_INDISPONIVEL");
    await expect(book(await at("17:45", 3))).rejects.toThrow("HORARIO_INDISPONIVEL");
    await sql`insert into schedule_blocks(business_id,starts_at,ends_at) values(${business},${await at("14:00",3)},${await at("15:00",3)})`;
    await expect(book(await at("13:45",3))).rejects.toThrow("HORARIO_INDISPONIVEL");
    await sql`update business_hours set break_start=null,break_end=null,open_time='08:00' where business_id=${business}`;
  });
  it("enforces null, past and 120-day rejection and the 90-day boundary", async () => {
    await expect(book(null)).rejects.toThrow("DATA_INVALIDA");
    await expect(book(await at("08:00",-1))).rejects.toThrow("DATA_PASSADA");
    await expect(book(await at("08:00",120))).rejects.toThrow("ANTECEDENCIA_MAXIMA");
    expect(await book(await at("08:00",90))).toBeTruthy();
  });
  it("rejects cross-tenant services", async () => {
    await expect(book(await at("08:00",4),"Nome",randomUUID(),otherService)).rejects.toThrow("SERVICO_INDISPONIVEL");
  });
  it("denies anonymous and authenticated direct booking execution", async () => {
    for (const role of ["anon","authenticated"]) {
      const p = await sql`select has_function_privilege(${role},'public.create_booking_request(text,uuid,timestamptz,text,text,text,text,text,uuid)','EXECUTE') as allowed,has_function_privilege(${role},'public.submit_verified_booking(text,text,uuid,timestamptz,text,text,text,text,text,uuid)','EXECUTE') as verified`;
      expect(p[0]?.["allowed"]).toBe(false);
      expect(p[0]?.["verified"]).toBe(false);
    }
    await expect(sql.begin(async (tx) => {
      await tx`set local role anon`;
      await tx`select public.create_booking_request(${slug},${service},now(),'Nome','11987654321','Onix','','',${randomUUID()})`;
    })).rejects.toThrow(/permission denied/);
  });
  it("isolates customer reads for a member of only one business", async () => {
    await sql`insert into customers(business_id,name,phone) values(${otherBusiness},'Private B','5511912345678')`;
    const rows = await sql.begin(async (tx) => {
      await tx`set local role authenticated`;
      await tx`select set_config('request.jwt.claim.sub',${owner},true)`;
      return tx`select business_id from customers`;
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r["business_id"]===business)).toBe(true);
  });
  it("makes concurrent retries idempotent and protects conflicting bookings with GiST", async () => {
    const start = await at("08:00",5); const key=randomUUID();
    const ids=await Promise.all([book(start,"Nome",key),book(start,"Nome",key)]);
    expect(ids[0]).toBe(ids[1]);
    const conflict=await Promise.allSettled([book(await at("10:00",5)),book(await at("10:00",5))]);
    expect(conflict.filter((r)=>r.status==='fulfilled')).toHaveLength(1);
    expect(conflict.filter((r)=>r.status==='rejected')).toHaveLength(1);
    const constraint=await sql`select contype from pg_constraint where conrelid='public.appointments'::regclass and conname='appointments_no_overlap'`;
    expect(constraint[0]?.["contype"]).toBe("x");
  });
  it("counts concurrent invalid attempts atomically and retains counters on failure", async () => {
    const results=await Promise.all(Array.from({length:6},()=>sql`select public.submit_verified_booking(${origin},${slug},${service},null,'Nome','11987654321','Onix','','',${randomUUID()}) as result`));
    expect(results.filter((r)=>r[0]?.["result"]?.error==='LIMITE_SOLICITACOES')).toHaveLength(1);
    const counter=await sql`select attempts from booking_origin_counters where origin_hash=${origin} and scope=${business}`;
    expect(counter[0]?.["attempts"]).toBe(6);
  });
});