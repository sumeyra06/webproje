-- ALTER TABLE script to add new invoice fields if they do not exist
-- Run safely; Postgres ignores duplicate column addition attempts with DO blocks.

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.invoices ADD COLUMN invoice_no text;
  EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN
    ALTER TABLE public.invoices ADD COLUMN category text;
  EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN
    ALTER TABLE public.invoices ADD COLUMN tags text[];
  EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN
    ALTER TABLE public.invoices ADD COLUMN stock_tracking_mode text; -- 'out' | 'noout'
  EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN
    ALTER TABLE public.invoices ADD COLUMN edit_date date;
  EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN
    ALTER TABLE public.invoices ADD COLUMN due_date date;
  EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN
    ALTER TABLE public.invoices ADD COLUMN collection_status text;
  EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN
    ALTER TABLE public.invoices ADD COLUMN currency text;
  EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN
    ALTER TABLE public.invoices ADD COLUMN items jsonb;
  EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN
    ALTER TABLE public.invoices ADD COLUMN subtotal numeric(14,2);
  EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN
    ALTER TABLE public.invoices ADD COLUMN tax_total numeric(14,2);
  EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN
    ALTER TABLE public.invoices ADD COLUMN total numeric(14,2);
  EXCEPTION WHEN duplicate_column THEN NULL; END;
END$$;

-- Optional index for invoice_no search
CREATE INDEX IF NOT EXISTS invoices_invoice_no_idx ON public.invoices (invoice_no);
