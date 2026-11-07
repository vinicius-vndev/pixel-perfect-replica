ALTER TABLE public.appointments ADD COLUMN declared_customer_name text, ADD COLUMN declared_customer_phone text, ADD COLUMN verified_origin_hash text;
CREATE TABLE public.booking_origin_counters (origin_hash text NOT NULL, scope text NOT NULL, window_start timestamptz NOT NULL, attempts integer NOT NULL DEFAULT 0, PRIMARY KEY(origin_hash,scope,window_start));
GRANT ALL ON public.booking_origin_counters TO service_role;
ALTER TABLE public.booking_origin_counters ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public._slot_is_free(_business_id uuid, _start timestamptz, _end timestamptz) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _b businesses; _ls timestamp; _le timestamp; _h business_hours;
BEGIN
 SELECT * INTO _b FROM businesses WHERE id=_business_id;
 IF NOT FOUND OR _start IS NULL OR _end IS NULL OR NOT isfinite(_start) OR NOT isfinite(_end) OR _start < now() OR _end <= _start THEN RETURN false; END IF;
 _ls := _start AT TIME ZONE _b.timezone; _le := _end AT TIME ZONE _b.timezone;
 IF _ls::date > (now() AT TIME ZONE _b.timezone)::date + 90 OR _ls::date <> _le::date THEN RETURN false; END IF;
 SELECT * INTO _h FROM business_hours WHERE business_id=_business_id AND weekday=extract(dow FROM _ls)::int;
 IF NOT FOUND OR NOT _h.is_open OR _ls::time < _h.open_time OR _le::time > _h.close_time THEN RETURN false; END IF;
 IF mod(extract(epoch FROM (_ls - (_ls::date + _h.open_time))), _b.slot_interval_minutes * 60) <> 0 THEN RETURN false; END IF;
 IF _h.break_start IS NOT NULL AND _ls::time < _h.break_end AND _le::time > _h.break_start THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM schedule_blocks WHERE business_id=_business_id AND tstzrange(starts_at,ends_at,'[)') && tstzrange(_start,_end,'[)')) THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM appointments WHERE business_id=_business_id AND status IN ('pendente','confirmado') AND tstzrange(starts_at,ends_at,'[)') && tstzrange(_start,_end,'[)')) THEN RETURN false; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public._slot_is_free(uuid,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.create_booking_request(_slug text,_service_id uuid,_starts_at timestamptz,_name text,_phone text,_vehicle_model text,_plate text,_notes text,_request_key uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _b businesses; _s services; _phone_n text; _cust uuid; _veh uuid; _appt uuid; _end timestamptz; _plate_n text;
BEGIN
 SELECT * INTO _b FROM businesses WHERE slug=_slug;
 IF NOT FOUND THEN RAISE EXCEPTION 'ESTETICA_NAO_ENCONTRADA'; END IF;
 IF _request_key IS NULL THEN RAISE EXCEPTION 'DADOS_INVALIDOS'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_b.id::text || _request_key::text,0));
 SELECT id INTO _appt FROM appointments WHERE business_id=_b.id AND request_key=_request_key;
 IF FOUND THEN RETURN _appt; END IF;
 IF _starts_at IS NULL OR NOT isfinite(_starts_at) THEN RAISE EXCEPTION 'DATA_INVALIDA'; END IF;
 IF _starts_at < now() THEN RAISE EXCEPTION 'DATA_PASSADA'; END IF;
 IF (_starts_at AT TIME ZONE _b.timezone)::date > (now() AT TIME ZONE _b.timezone)::date+90 THEN RAISE EXCEPTION 'ANTECEDENCIA_MAXIMA'; END IF;
 SELECT * INTO _s FROM services WHERE id=_service_id AND business_id=_b.id AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'SERVICO_INDISPONIVEL'; END IF;
 _name:=trim(coalesce(_name,'')); _vehicle_model:=trim(coalesce(_vehicle_model,'')); _phone_n:=public.normalize_phone(_phone);
 _plate_n:=nullif(upper(regexp_replace(coalesce(_plate,''),'[^A-Za-z0-9]','','g')),'');
 IF length(_name)<2 OR length(_name)>120 THEN RAISE EXCEPTION 'NOME_INVALIDO'; END IF;
 IF _phone_n IS NULL OR _phone_n !~ '^[0-9]{12,15}$' THEN RAISE EXCEPTION 'TELEFONE_INVALIDO'; END IF;
 IF length(_vehicle_model)<2 OR length(_vehicle_model)>80 THEN RAISE EXCEPTION 'VEICULO_INVALIDO'; END IF;
 IF _plate_n IS NOT NULL AND length(_plate_n)>10 THEN RAISE EXCEPTION 'PLACA_INVALIDA'; END IF;
 IF length(coalesce(_notes,''))>1000 THEN RAISE EXCEPTION 'OBSERVACAO_LONGA'; END IF;
 _end:=_starts_at+make_interval(mins=>_s.duration_minutes);
 IF NOT public._slot_is_free(_b.id,_starts_at,_end) THEN RAISE EXCEPTION 'HORARIO_INDISPONIVEL'; END IF;
 INSERT INTO customers(business_id,name,phone) VALUES(_b.id,_name,_phone_n) ON CONFLICT(business_id,phone) DO NOTHING RETURNING id INTO _cust;
 IF _cust IS NULL THEN SELECT id INTO _cust FROM customers WHERE business_id=_b.id AND phone=_phone_n; END IF;
 SELECT id INTO _veh FROM vehicles WHERE business_id=_b.id AND customer_id=_cust AND lower(model)=lower(_vehicle_model) AND coalesce(plate,'')=coalesce(_plate_n,'') LIMIT 1;
 IF _veh IS NULL THEN INSERT INTO vehicles(business_id,customer_id,model,plate) VALUES(_b.id,_cust,_vehicle_model,_plate_n) RETURNING id INTO _veh; END IF;
 BEGIN
 INSERT INTO appointments(business_id,customer_id,vehicle_id,service_id,service_name,price_cents,duration_minutes,starts_at,ends_at,status,notes,request_key,declared_customer_name,declared_customer_phone)
 VALUES(_b.id,_cust,_veh,_s.id,_s.name,_s.price_cents,_s.duration_minutes,_starts_at,_end,'pendente',nullif(trim(coalesce(_notes,'')),''),_request_key,_name,_phone_n) RETURNING id INTO _appt;
 EXCEPTION WHEN exclusion_violation THEN RAISE EXCEPTION 'HORARIO_INDISPONIVEL'; END;
 INSERT INTO appointment_status_history(appointment_id,business_id,new_status,changed_by_label) VALUES(_appt,_b.id,'pendente','Cliente (página pública)');
 RETURN _appt;
END $$;
REVOKE ALL ON FUNCTION public.create_booking_request(text,uuid,timestamptz,text,text,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_request(text,uuid,timestamptz,text,text,text,text,text,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.submit_verified_booking(_origin_hash text,_slug text,_service_id uuid,_starts_at timestamptz,_name text,_phone text,_vehicle_model text,_plate text,_notes text,_request_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _business uuid; _window timestamptz:=date_trunc('hour',now()); _n integer; _id uuid; _old_origin text; _error text;
BEGIN
 IF _origin_hash IS NULL OR _origin_hash !~ '^[a-f0-9]{64}$' THEN RETURN jsonb_build_object('error','ORIGEM_INVALIDA'); END IF;
 SELECT id INTO _business FROM businesses WHERE slug=_slug;
 IF _business IS NULL THEN RETURN jsonb_build_object('error','ESTETICA_NAO_ENCONTRADA'); END IF;
 IF _request_key IS NULL THEN RETURN jsonb_build_object('error','DADOS_INVALIDOS'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_business::text || _request_key::text,0));
 SELECT id,verified_origin_hash INTO _id,_old_origin FROM appointments WHERE business_id=_business AND request_key=_request_key;
 IF FOUND THEN
 IF _old_origin IS DISTINCT FROM _origin_hash THEN RETURN jsonb_build_object('error','DADOS_INVALIDOS'); END IF;
 RETURN jsonb_build_object('id',_id);
 END IF;
 INSERT INTO booking_origin_counters VALUES(_origin_hash,'all',_window,1) ON CONFLICT(origin_hash,scope,window_start) DO UPDATE SET attempts=booking_origin_counters.attempts+1 RETURNING attempts INTO _n;
 IF _n>10 THEN RETURN jsonb_build_object('error','LIMITE_SOLICITACOES'); END IF;
 INSERT INTO booking_origin_counters VALUES(_origin_hash,_business::text,_window,1) ON CONFLICT(origin_hash,scope,window_start) DO UPDATE SET attempts=booking_origin_counters.attempts+1 RETURNING attempts INTO _n;
 IF _n>5 THEN RETURN jsonb_build_object('error','LIMITE_SOLICITACOES'); END IF;
 BEGIN
 _id:=public.create_booking_request(_slug,_service_id,_starts_at,_name,_phone,_vehicle_model,_plate,_notes,_request_key);
 UPDATE appointments SET verified_origin_hash=_origin_hash WHERE id=_id;
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS _error=MESSAGE_TEXT; RETURN jsonb_build_object('error',_error); END;
 RETURN jsonb_build_object('id',_id);
END $$;
REVOKE ALL ON FUNCTION public.submit_verified_booking(text,text,uuid,timestamptz,text,text,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_verified_booking(text,text,uuid,timestamptz,text,text,text,text,text,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.media_business_id(_path text) RETURNS uuid LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
BEGIN RETURN split_part(_path,'/',1)::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN NULL; END $$;
REVOKE ALL ON FUNCTION public.media_business_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.media_business_id(text) TO anon,authenticated,service_role;
ALTER POLICY "media public read" ON storage.objects USING(bucket_id='business-media' AND public.media_business_id(name) IS NOT NULL AND EXISTS(SELECT 1 FROM public.businesses WHERE id=public.media_business_id(name)) AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp'));
ALTER POLICY "media member insert" ON storage.objects WITH CHECK(bucket_id='business-media' AND public.is_business_member(public.media_business_id(name)) AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp') AND metadata->>'mimetype' IN ('image/jpeg','image/png','image/webp') AND (metadata->>'size')::bigint <= 5242880);
ALTER POLICY "media member update" ON storage.objects USING(bucket_id='business-media' AND public.is_business_member(public.media_business_id(name))) WITH CHECK(bucket_id='business-media' AND public.is_business_member(public.media_business_id(name)) AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp') AND metadata->>'mimetype' IN ('image/jpeg','image/png','image/webp') AND (metadata->>'size')::bigint <= 5242880);
ALTER POLICY "media member delete" ON storage.objects USING(bucket_id='business-media' AND public.is_business_member(public.media_business_id(name)));