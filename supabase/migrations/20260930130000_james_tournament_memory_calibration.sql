-- Calibrate tournament-memory confidence so one experiment cannot dominate
-- the learned confidence signal. A small Bayesian prior smooths success rate,
-- while evidence maturity caps confidence until repeated outcomes accumulate.

CREATE OR REPLACE FUNCTION public.calibrate_james_tournament_memory()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric := greatest(0, coalesce(NEW.success_count, 0) + coalesce(NEW.failure_count, 0));
  v_success_rate numeric;
  v_avg_quality numeric := 0.5;
  v_strength numeric;
  v_raw_confidence numeric;
  v_maturity_cap numeric;
  v_events jsonb;
BEGIN
  IF coalesce(NEW.pattern, '') NOT LIKE 'fun-zone:tournament:%' THEN
    RETURN NEW;
  END IF;

  -- Beta(2,2) prior: one success/failure cannot immediately imply certainty.
  v_success_rate := (coalesce(NEW.success_count, 0) + 2.0) / (v_total + 4.0);

  v_events := coalesce(NEW.last_evidence->'outcomeEvents', '[]'::jsonb);
  IF jsonb_typeof(v_events) = 'array' AND jsonb_array_length(v_events) > 0 THEN
    SELECT coalesce(avg(greatest(0, least(1, (value->>'quality')::numeric))), 0.5)
      INTO v_avg_quality
    FROM jsonb_array_elements(v_events) AS e(value)
    WHERE (value->>'quality') ~ '^[0-9]+(\\.[0-9]+)?$';
  END IF;

  v_strength := least(1, v_total / 8.0);
  v_raw_confidence :=
    v_success_rate * 0.55 +
    v_avg_quality * 0.30 +
    v_strength * 0.15;

  -- Confidence matures gradually; even perfect early evidence is capped.
  v_maturity_cap := least(0.99, 0.45 + (least(v_total, 10) * 0.05));

  NEW.confidence := greatest(0.10, least(v_maturity_cap, v_raw_confidence));
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS james_tournament_memory_calibration_trigger
  ON public.james_experiences;

CREATE TRIGGER james_tournament_memory_calibration_trigger
BEFORE INSERT OR UPDATE OF success_count, failure_count, confidence, last_evidence
ON public.james_experiences
FOR EACH ROW
EXECUTE FUNCTION public.calibrate_james_tournament_memory();
