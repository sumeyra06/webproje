-- supabase-stock-rpc.sql
-- Stock operations exposed as RPC for the app
-- Run this in Supabase SQL editor

create or replace function public.decrement_product_stock(p_id uuid, p_qty numeric)
returns void
language plpgsql
security definer
as $$
begin
  -- Basic guards
  if p_qty is null or p_qty <= 0 then
    return;
  end if;
  -- Only affect rows owned by current user and with stock tracking enabled
  update public.products p
    set stock = greatest(coalesce(p.stock,0) - p_qty, 0)
  where p.id = p_id
    and (p.owner_id is null or p.owner_id = auth.uid())
    and coalesce(p.stock_tracking, true) = true;
end;
$$;

-- Optional: increment (not used now, but handy for cancellations/returns)
create or replace function public.increment_product_stock(p_id uuid, p_qty numeric)
returns void
language plpgsql
security definer
as $$
begin
  if p_qty is null or p_qty <= 0 then
    return;
  end if;
  update public.products p
    set stock = coalesce(p.stock,0) + p_qty
  where p.id = p_id
    and (p.owner_id is null or p.owner_id = auth.uid())
    and coalesce(p.stock_tracking, true) = true;
end;
$$;

-- Grants so PostgREST roles can execute
revoke all on function public.decrement_product_stock(uuid, numeric) from public;
revoke all on function public.increment_product_stock(uuid, numeric) from public;
grant execute on function public.decrement_product_stock(uuid, numeric) to anon, authenticated;
grant execute on function public.increment_product_stock(uuid, numeric) to anon, authenticated;

-- Refresh PostgREST schema cache (so the API sees new/changed functions)
-- You can also use the Supabase UI: Database > API > Refresh
notify pgrst, 'reload schema';

-- Notes:
-- - Consider adding RLS policies on products to ensure owner isolation if not already in place.
-- - For per-warehouse tracking, prefer writing to public.product_stocks instead of products.stock and let triggers sync totals.
