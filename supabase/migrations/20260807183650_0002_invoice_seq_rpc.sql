/*
# Invoice sequence RPC

Adds a `next_invoice_seq()` function returning the next invoice sequence value.
Used as a fallback when settings.invoice_counter is unavailable.
*/

CREATE OR REPLACE FUNCTION next_invoice_seq()
RETURNS bigint AS $$
DECLARE
  next_val bigint;
BEGIN
  next_val := nextval('invoice_seq');
  RETURN next_val;
END;
$$ LANGUAGE plpgsql;
