CREATE OR REPLACE FUNCTION get_public_landing_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  residents_count INT;
  flats_count INT;
  processed_bills_sum DECIMAL;
  blocks_count INT;
  complaints_open_count INT;
  visitors_today_count INT;
  notices_count INT;
BEGIN
  -- We use SECURITY DEFINER to bypass RLS and return ONLY aggregate stats 
  -- so that the public landing page can display them without exposing PII.

  SELECT count(*) INTO residents_count FROM residents;
  SELECT count(*) INTO flats_count FROM flats;
  SELECT COALESCE(sum(amount), 0) INTO processed_bills_sum FROM bills WHERE status = 'paid';
  SELECT count(*) INTO blocks_count FROM blocks;
  SELECT count(*) INTO complaints_open_count FROM complaints WHERE status = 'open';
  SELECT count(*) INTO visitors_today_count FROM visitors WHERE date(entry_time) = CURRENT_DATE;
  SELECT count(*) INTO notices_count FROM notices;

  RETURN json_build_object(
    'residents', residents_count,
    'flats', flats_count,
    'processed_bills', processed_bills_sum,
    'blocks', blocks_count,
    'complaints_open', complaints_open_count,
    'visitors_today', visitors_today_count,
    'notices', notices_count
  );
END;
$$;
