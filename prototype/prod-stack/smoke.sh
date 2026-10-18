#!/usr/bin/env bash
# PROTOTYP (#277): dymny test prod-podobnego stacku. Wymaga curl i jq.
#
#   ./smoke.sh                    # domyślnie http://localhost:8080
#   BASE_URL=http://host:8080 ./smoke.sh
#
# Sprawdza to, o co pyta ticket: statyki obu SPA, deep linki, logowanie,
# listę turniejów, publiczny turniej i upload logo pod tym samym originem.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
API="${BASE_URL}/api/v1"
HERE="$(cd "$(dirname "$0")" && pwd)"
FIXTURE="${HERE}/fixtures/logo.png"

fail() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "ok: $*"; }

echo "Czekam na ${BASE_URL}/up…"
for _ in $(seq 1 60); do
    curl -sf -o /dev/null "${BASE_URL}/up" && break
    sleep 2
done
curl -sf -o /dev/null "${BASE_URL}/up" || fail "/up nie odpowiada"
pass "/up"

curl -sf "${BASE_URL}/" | grep -q '<div id="root">' || fail "strona publiczna bez root"
pass "strona publiczna pod /"

curl -sf "${BASE_URL}/admin/" | grep -q '/admin/assets/' || fail "panel bez assetów /admin/"
pass "panel pod /admin/"

code="$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/admin/login")"
[ "$code" = "200" ] || fail "deep link /admin/login → ${code}"
pass "deep link panelu (/admin/login)"

code="$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/t/liga-osiedlowa-2026")"
[ "$code" = "200" ] || fail "deep link /t/{slug} → ${code}"
pass "deep link strony publicznej (/t/{slug})"

LOGIN="$(curl -sf -X POST "${API}/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"dawid@example.com","password":"tajnehaslo123"}')" \
    || fail "logowanie konta z seeda"
TOKEN="$(echo "$LOGIN" | jq -r '.data.token')"
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] || fail "brak tokenu w /login"
pass "logowanie i token Bearer"

LIST="$(curl -sf "${API}/tournaments" -H "Authorization: Bearer ${TOKEN}")" \
    || fail "GET /tournaments"
echo "$LIST" | jq -e '.data | map(.slug) | index("liga-osiedlowa-2026")' >/dev/null \
    || fail "seed demo bez liga-osiedlowa-2026"
pass "GET /tournaments (seed demo)"

PUBLIC="$(curl -sf "${API}/public/t/liga-osiedlowa-2026")" || fail "publiczny turniej"
[ "$(echo "$PUBLIC" | jq -r '.data.name')" = "Liga Osiedlowa 2026" ] \
    || fail "publiczny turniej ma inną nazwę"
pass "publiczny turniej po slugu"

TOURNAMENT_ID="$(echo "$LIST" | jq -r '.data[] | select(.slug=="liga-osiedlowa-2026") | .id')"
UPLOADED="$(curl -sf -X POST "${API}/tournaments/${TOURNAMENT_ID}/logo" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H 'Accept: application/json' \
    -F "logo=@${FIXTURE};type=image/png")" || fail "upload logo"
LOGO_URL="$(echo "$UPLOADED" | jq -r '.data.branding.logoUrl')"
case "$LOGO_URL" in
    "${BASE_URL}/storage/"*) ;;
    *) fail "logoUrl nie wskazuje na ${BASE_URL}/storage: ${LOGO_URL}" ;;
esac
curl -sf -o /tmp/s6-smoke-logo.png "$LOGO_URL" || fail "pobranie uploadu ${LOGO_URL}"
cmp -s "$FIXTURE" /tmp/s6-smoke-logo.png || fail "pobrany upload różni się od wysłanego"
pass "upload logo i serwowanie z /storage/"

echo "OK: stack działa end-to-end pod ${BASE_URL}"
