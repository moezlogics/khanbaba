-- ===================================================================
--  Push notification diagnostics — READ ONLY, changes nothing.
--
--    sudo -u postgres psql -d khanbabadb < push-diagnostics.sql
-- ===================================================================

\echo
\echo '=== 1. Subscriber states (did sends deactivate people?) ==='
SELECT
  count(*) FILTER (WHERE deleted_at IS NULL AND is_active)      AS active,
  count(*) FILTER (WHERE deleted_at IS NULL AND NOT is_active)  AS deactivated,
  count(*) FILTER (WHERE deleted_at IS NOT NULL)                AS deleted,
  count(*)                                                      AS all_rows
FROM push_subscription;

\echo
\echo '=== 2. When were subscribers deactivated? (spikes = a send did it) ==='
SELECT date_trunc('hour', updated_at) AS hour, count(*) AS deactivated
FROM push_subscription
WHERE deleted_at IS NULL AND NOT is_active
GROUP BY 1 ORDER BY 1 DESC LIMIT 10;

\echo
\echo '=== 3. Last 10 campaigns ==='
SELECT id, left(title, 30) AS title, status, total_targeted, total_sent, total_failed, created_at
FROM push_campaign
ORDER BY created_at DESC LIMIT 10;

\echo
\echo '=== 4. WHY did deliveries fail? (latest campaign with a delivery log) ==='
SELECT d.status, d.status_code, count(*) AS n, left(max(d.error), 120) AS sample_error
FROM push_delivery d
WHERE d.campaign_id = (
  SELECT campaign_id FROM push_delivery ORDER BY created_at DESC LIMIT 1
)
GROUP BY d.status, d.status_code
ORDER BY n DESC;

\echo
\echo '=== 5. Which push service do subscribers use? ==='
SELECT
  CASE
    WHEN endpoint LIKE 'https://fcm.googleapis.com/%'           THEN 'Chrome / Android (FCM)'
    WHEN endpoint LIKE 'https://updates.push.services.mozilla%' THEN 'Firefox'
    WHEN endpoint LIKE 'https://web.push.apple.com/%'           THEN 'Safari / iOS'
    WHEN endpoint LIKE '%notify.windows.com%'                   THEN 'Edge (WNS)'
    ELSE 'other'
  END AS service,
  count(*) AS n
FROM push_subscription
WHERE deleted_at IS NULL
GROUP BY 1 ORDER BY n DESC;
