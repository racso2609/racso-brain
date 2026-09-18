-- =================================================================
-- 1. Function: delete_ledger_on_order_delete()
-- =================================================================
CREATE OR REPLACE FUNCTION delete_ledger_on_order_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.financial_transaction_id IS NOT NULL THEN
    DELETE FROM financial_transactions
    WHERE id = OLD.financial_transaction_id;
  END IF;
  RETURN OLD;
END;
$$;

-- =================================================================
-- 2. Trigger: on_order_deleted
-- =================================================================
DROP TRIGGER IF EXISTS on_order_deleted ON maintenance_orders;
CREATE TRIGGER on_order_deleted
AFTER DELETE ON maintenance_orders
FOR EACH ROW
EXECUTE FUNCTION delete_ledger_on_order_delete();
