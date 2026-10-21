-- Source simulator data and receiver inbox are deliberately separate resources.
create table private.lead_sim_drivers (
  id text primary key, name text not null, phone text not null check(phone ~ '^0[0-9]{9}$'),
  state text not null default 'account_created', registration_state text not null default 'account_created', registration_at timestamptz, created_at timestamptz not null default now(),
  created_by bigint not null references public.sales(id)
);
create table private.lead_sim_orders (
  id text primary key, driver_id text not null references private.lead_sim_drivers(id),
  status text not null check(status in ('order_received','order_cancelled','first_order_completed')),
  occurred_at timestamptz not null
);
create table private.lead_core_links (
  driver_id text primary key references private.lead_sim_drivers(id),
  lead_id text not null unique references public.leads(id),
  confirmed_by bigint not null references public.sales(id), confirmed_at timestamptz not null default now()
);
create table private.lead_sim_outbox (
  id text primary key, driver_id text not null references private.lead_sim_drivers(id), payload jsonb not null,
  created_at timestamptz not null default now(), actor_id bigint not null references public.sales(id)
);
create table private.lead_core_events (
  id text primary key, payload jsonb not null, received_at timestamptz not null default now(),
  processed_at timestamptz, lead_id text references public.leads(id),
  status text not null default 'received', message text not null default '', attempts integer not null default 0
);
create table private.lead_core_attempts (
  id bigint generated always as identity primary key, event_id text not null references private.lead_core_events(id),
  at timestamptz not null default now(), status text not null, message text not null
);
revoke all on all tables in schema private from public,anon,authenticated;

create function private.lead_core_process(p_id text) returns void language plpgsql security definer set search_path=public,private as $$
declare e private.lead_core_events; l jsonb; driver private.lead_sim_drivers; linked text;
  typ text; moment timestamptz; status_value text; message_value text; next_status text; t record;
begin
  select * into e from private.lead_core_events where id=p_id for update;
  if e.status in ('processed','ignored') then return; end if;
  typ:=e.payload->>'eventType';
  begin
    perform private.lead_assert(e.payload->>'sourceSystem'='driver-simulator','Nguồn gửi không hợp lệ.');
    perform private.lead_assert(typ in ('account_created','registration_pending','registration_completed','order_received','order_cancelled','first_order_completed'),'Loại sự kiện không hợp lệ.');
    moment:=(e.payload->>'occurredAt')::timestamptz;
    perform private.lead_assert(moment<=now() and moment>='2000-01-01'::timestamptz,'Ngày sự kiện không hợp lệ hoặc ở tương lai.');
    perform private.lead_assert(length(e.payload->>'externalDriverId') between 1 and 120 and e.payload->>'phone' ~ '^0[0-9]{9}$','Danh tính tài xế không hợp lệ.');
    if typ like '%order%' then perform private.lead_assert(length(btrim(e.payload->>'orderId')) between 1 and 120,'Sự kiện đơn hàng cần mã đơn.'); end if;
    select * into driver from private.lead_sim_drivers where id=e.payload->>'externalDriverId';
    select lead_id into linked from private.lead_core_links where driver_id=e.payload->>'externalDriverId';
    if linked is null then
      status_value:='waiting_link'; message_value:='Chưa liên kết tài xế với Lead được phép thử.';
    else
      select data into l from public.leads where id=linked for update;
      if l->>'phone' is distinct from e.payload->>'phone' or driver.phone is distinct from e.payload->>'phone' then
        status_value:='conflict'; message_value:='Số điện thoại nguồn khác hồ sơ đã liên kết.';
      elsif typ not in ('registration_completed','first_order_completed') then
        status_value:='ignored'; message_value:='Đã ghi nhận tình trạng nguồn; chưa đủ điều kiện chuyển trạng thái Lead.';
      elsif (l->>'archived')::boolean or l->>'status'='Closed' or l ? 'coreCorrectionAt' then
        status_value:='conflict'; message_value:='Lead đã đóng/lưu trữ hoặc có đính chính; cần đối soát, không tự ghi đè.';
      elsif typ='first_order_completed' and not (l ? 'activatedAt') then
        status_value:='waiting_registration'; message_value:='Chờ sự kiện đăng ký hợp lệ.';
      elsif typ='first_order_completed' and moment<(l->>'activatedAt')::timestamptz then
        status_value:='conflict'; message_value:='Thời điểm đơn hoàn thành trước thời điểm đăng ký.';
      elsif (typ='registration_completed' and l ? 'activatedAt') or (typ='first_order_completed' and l ? 'onboardedAt') then
        status_value:='ignored'; message_value:='Đã có mốc kết quả; giữ nguyên mốc đầu, không đếm lại.';
      else
        next_status:=case when typ='registration_completed' then 'Activated' else 'Onboarded' end;
        l:=l||jsonb_build_object('status',next_status,'updatedAt',now(),'version',coalesce((l->>'version')::int,1)+1,'externalDriverId',driver.id,'coreSource','driver-simulator');
        if typ='registration_completed' then
          l:=l||jsonb_build_object('activatedAt',moment,'activatedSource','simulator','activatedEventId',e.id,'activatedReceivedAt',e.received_at);
        else
          l:=l||jsonb_build_object('onboardedAt',moment,'onboardedSource','simulator','onboardedEventId',e.id,'onboardedReceivedAt',e.received_at,'firstOrderId',e.payload->>'orderId');
        end if;
        update public.leads set data=l where id=linked;
        for t in select id from public.lead_assignments where lead_id=linked and status in ('New','Open') loop
          update public.lead_assignments set data=data||jsonb_build_object('status','Solved','updatedAt',now(),'version',coalesce((data->>'version')::int,1)+1) where id=t.id;
          perform private.lead_cancel_appointments(t.id);
        end loop;
        insert into public.lead_audit_logs(data,lead_id) values(jsonb_build_object('id','LOG-'||gen_random_uuid(),'at',now(),'actorId','driver-simulator','action','Kết quả từ hệ thống giả lập','target',linked,'detail',e.payload::text,'eventId',e.id),linked);
        status_value:='processed'; message_value:='Đã cập nhật '||next_status||' từ nguồn giả lập.';
      end if;
    end if;
  exception when others then
    status_value:='rejected'; message_value:=sqlerrm;
  end;
  update private.lead_core_events set status=status_value,message=message_value,lead_id=linked,processed_at=now() where id=p_id;
end $$;

-- Only the trusted HTTP receiver can call this (no browser RPC grant).
create function private.lead_core_receive(p_event jsonb) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare e private.lead_core_events; pending record; collision boolean:=false;
begin
  perform private.lead_assert(jsonb_typeof(p_event)='object' and length(p_event->>'eventId') between 1 and 120,'Sự kiện cần eventId hợp lệ.');
  perform pg_advisory_xact_lock(179826221);
  insert into private.lead_core_events(id,payload) values(p_event->>'eventId',p_event) on conflict(id) do nothing;
  select * into e from private.lead_core_events where id=p_event->>'eventId' for update;
  update private.lead_core_events set attempts=attempts+1 where id=e.id;
  collision:=e.payload<>p_event;
  if collision then
    insert into private.lead_core_attempts(event_id,status,message) values(e.id,'id_collision','Cùng eventId nhưng nội dung khác; đã từ chối, giữ nguyên bản gốc.');
    return jsonb_build_object('eventId',e.id,'status','id_collision','message','Mã sự kiện đã dùng cho nội dung khác.');
  end if;
  perform private.lead_core_process(e.id);
  -- A late registration unlocks pending first-order events without inventing dates.
  if p_event->>'eventType'='registration_completed' then
    for pending in select id from private.lead_core_events where payload->>'externalDriverId'=p_event->>'externalDriverId' and status='waiting_registration' order by received_at,id loop
      update private.lead_core_events set attempts=attempts+1 where id=pending.id;
      perform private.lead_core_process(pending.id);
      insert into private.lead_core_attempts(event_id,status,message) select id,status,'Tự xử lý lại sau đăng ký: '||message from private.lead_core_events where id=pending.id;
    end loop;
  end if;
  select * into e from private.lead_core_events where id=e.id;
  insert into private.lead_core_attempts(event_id,status,message) values(e.id,e.status,e.message);
  return jsonb_build_object('eventId',e.id,'status',e.status,'message',e.message,'leadId',e.lead_id,'attempts',e.attempts);
end $$;

create function public.lead_simulator(p_command jsonb) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare a jsonb:=private.lead_actor(); kind text:=p_command->>'type'; driver private.lead_sim_drivers; linked jsonb; event_payload jsonb; moment timestamptz; typ text; phone_value text; event_id text;
begin
  perform private.lead_assert(a->>'role' in ('admin','intake'),'Chỉ Admin/Tiếp nhận được xem đối soát.');
  if kind='snapshot' then
    return jsonb_build_object(
      'drivers',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'phone',d.phone,'state',d.state,'registrationState',d.registration_state,'leadId',m.lead_id,'confirmedAt',m.confirmed_at) order by d.created_at desc) from private.lead_sim_drivers d left join private.lead_core_links m on m.driver_id=d.id),'[]'::jsonb),
      'orders',coalesce((select jsonb_agg(to_jsonb(o) order by o.occurred_at desc) from private.lead_sim_orders o),'[]'::jsonb),
      'events',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'driverId',o.driver_id,'payload',o.payload,'sentAt',o.created_at,'status',coalesce(e.status,'unsent'),'message',e.message,'receivedAt',e.received_at,'processedAt',e.processed_at,'leadId',e.lead_id,'attempts',coalesce(e.attempts,0)) order by o.created_at desc) from private.lead_sim_outbox o left join private.lead_core_events e on e.id=o.id),'[]'::jsonb),
      'inbox',coalesce((select jsonb_agg(to_jsonb(e) order by e.received_at desc) from private.lead_core_events e),'[]'::jsonb),
      'attempts',coalesce((select jsonb_agg(to_jsonb(t) order by t.id desc) from private.lead_core_attempts t),'[]'::jsonb));
  end if;
  if kind='retry' then
    select e.payload into event_payload from private.lead_core_events e where e.id=p_command->>'eventId';
    perform private.lead_assert(event_payload is not null,'Không tìm thấy sự kiện.');
    return jsonb_build_object('event',event_payload);
  end if;
  perform private.lead_assert(a->>'role'='admin','Chỉ Admin được thao tác hệ thống tài xế giả lập.');
  perform pg_advisory_xact_lock(179826221);
  if kind='createDriver' then
    phone_value:=regexp_replace(coalesce(p_command->>'phone',''),'[[:space:]().-]','','g');
    if phone_value ~ '^\+?84[0-9]{9}$' then phone_value:='0'||right(phone_value,9); end if;
    perform private.lead_assert(phone_value ~ '^0[0-9]{9}$' and length(btrim(p_command->>'name')) between 2 and 120,'Tên hoặc số điện thoại tài xế không hợp lệ.');
    event_id:='DRV-'||coalesce((p_command->>'requestId')::uuid,gen_random_uuid());
    insert into private.lead_sim_drivers(id,name,phone,created_by) values(event_id,btrim(p_command->>'name'),phone_value,(a->>'id')::bigint) on conflict(id) do nothing;
    select * into driver from private.lead_sim_drivers where id=event_id;
    perform private.lead_assert(driver.name=btrim(p_command->>'name') and driver.phone=phone_value and driver.created_by=(a->>'id')::bigint,'Mã tạo tài xế đã dùng cho nội dung khác.');
    return jsonb_build_object('driverId',driver.id);
  elsif kind='link' then
    select * into driver from private.lead_sim_drivers where id=p_command->>'driverId';
    select data into linked from public.leads where id=p_command->>'leadId';
    perform private.lead_assert(driver.id is not null and linked is not null and driver.phone=linked->>'phone' and not (linked->>'archived')::boolean,'Chọn đúng Lead có cùng số điện thoại, chưa lưu trữ.');
    if exists(select 1 from private.lead_core_links where driver_id=driver.id and lead_id=linked->>'id') then return '{"ok":true}'::jsonb; end if;
    perform private.lead_assert(not exists(select 1 from private.lead_core_links where driver_id=driver.id or lead_id=linked->>'id'),'Tài xế hoặc Lead đã có liên kết; không tự ghi đè liên kết.');
    insert into private.lead_core_links(driver_id,lead_id,confirmed_by) values(driver.id,linked->>'id',(a->>'id')::bigint);
    insert into public.lead_audit_logs(data,lead_id) values(jsonb_build_object('id','LOG-'||gen_random_uuid(),'at',now(),'actorId',a->>'id','action','Cho phép dùng giả lập','target',linked->>'id','detail',driver.id),linked->>'id');
    return '{"ok":true}'::jsonb;
  elsif kind='resend' then
    select o.payload into event_payload from private.lead_sim_outbox o where o.id=p_command->>'eventId';
    perform private.lead_assert(event_payload is not null,'Không tìm thấy bản tin nguồn.');
    return jsonb_build_object('event',event_payload);
  elsif kind='emit' then
    select * into driver from private.lead_sim_drivers where id=p_command->>'driverId';
    perform private.lead_assert(driver.id is not null,'Chọn tài xế giả lập.');
    typ:=p_command->>'eventType'; moment:=(p_command->>'occurredAt')::timestamptz;
    perform private.lead_assert(typ in ('account_created','registration_pending','registration_completed','order_received','order_cancelled','first_order_completed') and moment<=now() and moment>='2000-01-01'::timestamptz,'Loại hoặc ngày sự kiện không hợp lệ.');
    if typ like '%order%' then perform private.lead_assert(length(btrim(p_command->>'orderId')) between 1 and 120,'Nhập mã đơn.'); end if;
    event_id:=coalesce(p_command->>'requestId',gen_random_uuid()::text);
    perform private.lead_assert(length(event_id) between 1 and 120,'Mã sự kiện không hợp lệ.');
    event_payload:=jsonb_build_object('sourceSystem','driver-simulator','eventId',event_id,'externalDriverId',driver.id,'phone',driver.phone,'eventType',typ,'occurredAt',moment,'orderId',coalesce(p_command->>'orderId',''));
    insert into private.lead_sim_outbox(id,driver_id,payload,actor_id) values(event_id,driver.id,event_payload,(a->>'id')::bigint) on conflict(id) do nothing;
    perform private.lead_assert(exists(select 1 from private.lead_sim_outbox where id=event_id and private.lead_sim_outbox.payload=event_payload),'Mã gửi đã dùng cho nội dung khác.');
    update private.lead_sim_drivers set state=typ where id=driver.id;
    if typ in ('account_created','registration_pending','registration_completed') then
      update private.lead_sim_drivers set registration_state=typ,registration_at=moment where id=driver.id and (registration_at is null or registration_at<=moment) and (registration_state<>'registration_completed' or typ='registration_completed');
    else
      perform private.lead_assert(not exists(select 1 from private.lead_sim_orders where id=p_command->>'orderId' and driver_id<>driver.id),'Mã đơn đã thuộc tài xế khác.');
      insert into private.lead_sim_orders(id,driver_id,status,occurred_at) values(p_command->>'orderId',driver.id,typ,moment)
        on conflict(id) do update set status=excluded.status,occurred_at=excluded.occurred_at where private.lead_sim_orders.occurred_at<=excluded.occurred_at and private.lead_sim_orders.status<>'first_order_completed';
    end if;
    return jsonb_build_object('event',event_payload);
  end if;
  raise exception 'Thao tác giả lập không hợp lệ.';
end $$;
revoke all on function private.lead_core_process(text),private.lead_core_receive(jsonb) from public,anon,authenticated;
revoke all on function public.lead_simulator(jsonb) from public,anon;
grant execute on function public.lead_simulator(jsonb) to authenticated;
