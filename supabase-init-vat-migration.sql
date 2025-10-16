-- Set a default VAT rate for legacy products so KDV-based metrics are not zero
-- Adjust the value (20) if your standard VAT is different
update public.products
set vat_rate = 20
where coalesce(vat_rate, 0) = 0;