#!/bin/bash
# ===================================================================
#  Admin orders-app notifications — where does the chain break?
#  READ ONLY. Run from the backend folder on the server:
#
#    bash admin-push-check.sh
#
#  Optional overrides: DB=<database>  LOG=/path/to/medusa-out.log
# ===================================================================

DB="${DB:-khanbabadb}"
# PM2 writes to <site>/logs — find it whether run from the site root or backend/.
HERE="$(cd "$(dirname "$0")" && pwd)"
for c in "$LOG" "$HERE/logs/medusa-out.log" "$HERE/../logs/medusa-out.log" "logs/medusa-out.log" "../logs/medusa-out.log"; do
  [ -n "$c" ] && [ -f "$c" ] && { LOG="$c"; break; }
done
LOG="${LOG:-logs/medusa-out.log}"
psql_q() { sudo -u postgres psql -d "$DB" -tA -c "$1" < /dev/null 2>&1; }

echo
echo "=== 1. admin_push_subscription table exists? ==="
EXISTS=$(psql_q "SELECT to_regclass('public.admin_push_subscription') IS NOT NULL;")
echo "   $EXISTS"
if [ "$EXISTS" != "t" ]; then
  echo "   ❌ TABLE MISSING — the app can't register devices and orders find 0 recipients."
  echo "      Fix:  npx medusa db:migrate   (or:  sudo -u postgres psql -d $DB < admin-push-table.sql)"
fi

echo
echo "=== 2. Registered admin devices ==="
psql_q "SELECT count(*) FILTER (WHERE is_active AND deleted_at IS NULL) AS active,
               count(*) AS all_rows
        FROM admin_push_subscription;" | sed 's/^/   active|all = /'
psql_q "SELECT '   ' || coalesce(device_browser,'?') || '  created ' || to_char(created_at,'YYYY-MM-DD HH24:MI')
        FROM admin_push_subscription WHERE is_active AND deleted_at IS NULL
        ORDER BY created_at DESC LIMIT 5;"

echo
echo "=== 3. Subscriber loaded at startup? (needs a restart after deploy) ==="
if [ -f "$LOG" ]; then
  grep -a "\[AdminPush\] ✅ MODULE LOADED" "$LOG" | tail -2 | sed 's/^/   /'
  grep -aq "\[AdminPush\] ✅ MODULE LOADED" "$LOG" || echo "   ❌ never loaded — new build not deployed or not restarted"
else
  echo "   ⚠️ $LOG not found — check: pm2 describe <app>  (look for 'out log path')"
fi

echo
echo "=== 4. Last events that fired + what happened ==="
[ -f "$LOG" ] && grep -a "\[AdminPush\]" "$LOG" | grep -av "MODULE LOADED" | tail -12 | sed 's/^/   /'

echo
echo "=== 5. Worker mode of the RUNNING process (must be shared or worker) ==="
for pid in $(pgrep -f "medusa" 2>/dev/null); do
  mode=$(tr '\0' '\n' < /proc/$pid/environ 2>/dev/null | grep '^MEDUSA_WORKER_MODE=' | cut -d= -f2)
  echo "   pid $pid: MEDUSA_WORKER_MODE=${mode:-<unset = shared>}"
done

echo
echo "=== 6. Server clock (hours off breaks every push) ==="
echo "   server UTC: $(date -u '+%Y-%m-%d %H:%M:%S')"
echo
