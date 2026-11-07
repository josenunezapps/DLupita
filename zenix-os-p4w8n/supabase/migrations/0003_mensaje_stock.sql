-- Zenix OS · 0003_mensaje_stock
-- Mensaje de stock insuficiente legible ("hay 10 y quedarían -5") en lugar de "-5.0000000000000000".

-- Milésimas a texto argentino: 2500 → "2,5"; -5000 → "-5".
create function public.zos_fmt_qty(milli bigint)
returns text language sql immutable set search_path = ''
as $$
  select case when milli < 0 then '-' else '' end
      || (abs(milli) / 1000)::text
      || coalesce(nullif(',' || rtrim(lpad((abs(milli) % 1000)::text, 3, '0'), '0'), ','), '');
$$;
revoke execute on function public.zos_fmt_qty(bigint) from public, anon;
grant execute on function public.zos_fmt_qty(bigint) to authenticated;

create or replace function public.zos_adjust_stock(p_product uuid, p_qty_milli bigint, p_kind text, p_reason text)
returns bigint language plpgsql security definer set search_path = ''
as $$
declare
  pr public.zos_products;
  o public.zos_organizations;
  v_stock bigint;
  v_delta bigint;
begin
  select * into pr from public.zos_products where id = p_product for update;
  if not found or not public.zos_has_role(pr.organization_id, array['owner', 'supervisor']) then
    raise exception 'No tenés permiso para mover stock de este producto' using errcode = 'P0001';
  end if;
  if not pr.track_stock then
    raise exception 'Este producto no controla stock' using errcode = 'P0001';
  end if;
  if p_kind not in ('inicial', 'entrada', 'salida', 'ajuste') then
    raise exception 'Tipo de movimiento inválido' using errcode = 'P0001';
  end if;
  if p_kind in ('salida', 'ajuste') and coalesce(btrim(p_reason), '') = '' then
    raise exception 'Indicá el motivo del movimiento' using errcode = 'P0001';
  end if;
  if p_kind = 'inicial' and exists (select 1 from public.zos_stock_movements where product_id = p_product) then
    raise exception 'El stock inicial ya fue cargado: usá entrada o ajuste' using errcode = 'P0001';
  end if;
  select coalesce(sum(qty_milli), 0) into v_stock from public.zos_stock_movements where product_id = p_product;

  -- entrada/inicial suman; salida resta; ajuste fija el stock contado (p_qty_milli = cantidad real)
  v_delta := case p_kind
    when 'salida' then -abs(p_qty_milli)
    when 'ajuste' then p_qty_milli - v_stock
    else abs(p_qty_milli) end;
  if v_delta = 0 then
    raise exception 'El movimiento no cambia el stock' using errcode = 'P0001';
  end if;
  if p_kind = 'ajuste' and p_qty_milli < 0 then
    raise exception 'El stock contado no puede ser negativo' using errcode = 'P0001';
  end if;

  select * into o from public.zos_organizations where id = pr.organization_id;
  if not o.allow_negative_stock and v_stock + v_delta < 0 then
    raise exception 'No hay stock suficiente: hay % y quedarían %', public.zos_fmt_qty(v_stock), public.zos_fmt_qty(v_stock + v_delta) using errcode = 'P0001';
  end if;

  insert into public.zos_stock_movements (organization_id, product_id, qty_milli, kind, reason)
  values (pr.organization_id, p_product, v_delta, p_kind, nullif(btrim(p_reason), ''));
  return v_stock + v_delta;
end;
$$;
