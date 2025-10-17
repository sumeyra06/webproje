-- SQL checks for invoice INV-20251017-012634
SELECT * FROM public.invoices_v2 WHERE invoice_no = 'INV-20251017-012634';
SELECT * FROM public.invoice_items_v2 WHERE invoice_id IN (SELECT id FROM public.invoices_v2 WHERE invoice_no = 'INV-20251017-012634');
SELECT id, invoice_no, items FROM public.invoices WHERE invoice_no = 'INV-20251017-012634';
