-- Training/section listening tests must NOT contribute to the star
-- totals. Going forward the API skips test_results inserts for them
-- (see app/api/results/{route,cdi/route}.ts and
-- lib/utils/testCategory.ts), but any rows saved before this rollout
-- would still inflate the per-section counter. Delete them.
--
-- Convention: tests with type='listening' AND order_number >= 1001
-- are section-training runs; everything else is a full test. Adjust
-- the WHERE clause if the schema convention changes.

DELETE FROM test_results
WHERE test_id IN (
  SELECT id FROM tests
  WHERE type = 'listening' AND order_number >= 1001
);
