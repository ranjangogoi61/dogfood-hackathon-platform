#!/usr/bin/env bash
# Acceptance-style checks against a running, seeded portal.
# Usage: scripts/acceptance.sh [base_url]   (default http://localhost:3000)
set -u
B="${1:-http://localhost:3000}"
PW='DogfoodDemo123!'
J="$(mktemp -d)"
fail=0

login() { curl -s -c "$J/$1.jar" -H 'content-type: application/json' \
  -d "{\"email\":\"$2\",\"password\":\"$PW\"}" "$B/api/auth/login" -o /dev/null -w '%{http_code}'; }

for pair in "org:organizer" "ja:judge-a" "jb:judge-b" "p:participant"; do
  code="$(login "${pair%%:*}" "${pair##*:}@dogfood.local")"
  [ "$code" = "200" ] || { echo "FAIL login ${pair##*:} -> $code"; fail=1; }
done

status() { curl -s -o "$J/out" -w '%{http_code}' "$@"; }
check() { # name expected-regex actual
  if [[ "$3" =~ ^$2$ ]]; then echo "PASS $1 ($3)"; else echo "FAIL $1 (expected $2, got $3)"; fail=1; fi
}

EV=20000000-0000-4000-8000-000000000001
PROJ=50000000-0000-4000-8000-000000000001
CLOSED_PROJ=50000000-0000-4000-8000-000000000002
A_ASSIGN=70000000-0000-4000-8000-000000000001
B_ASSIGN=70000000-0000-4000-8000-000000000002

check "1 public gallery, unauthenticated" 200 "$(status "$B/api/gallery")"
if grep -q "Offline-First AI Workspace" "$J/out"; then echo "PASS 2 fixture project visible"; else echo "FAIL 2 fixture project not in gallery"; fail=1; fi
check "3 closed-event submission rejected" '4[0-9][0-9]' "$(status -b "$J/p.jar" -X POST "$B/api/projects/$CLOSED_PROJ/submit")"
check "4 judge reads own assignments" 200 "$(status -b "$J/ja.jar" "$B/api/judging/assignments")"
check "4b judge reads own score" 200 "$(status -b "$J/ja.jar" "$B/api/judging/scores?assignment_id=$A_ASSIGN")"
check "5 judge blocked from peer score" '40[13]' "$(status -b "$J/ja.jar" "$B/api/judging/scores?assignment_id=$B_ASSIGN")"
check "5b unauthenticated peer endpoint" 401 "$(status "$B/api/judging/scores")"
check "6 participant blocked from judge endpoint" '40[13]' "$(status -b "$J/p.jar" "$B/api/judging/assignments")"
check "7 organizer CSV export" 200 "$(status -b "$J/org.jar" "$B/api/events/$EV/export")"
check "7b judge blocked from export" '40[13]' "$(status -b "$J/ja.jar" "$B/api/events/$EV/export")"
check "extra submit by non-member judge blocked" '40[13]' "$(status -b "$J/ja.jar" -X POST "$B/api/projects/$PROJ/submit")"

rm -rf "$J"
exit $fail
