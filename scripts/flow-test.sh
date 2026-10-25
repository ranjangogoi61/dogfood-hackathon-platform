#!/usr/bin/env bash
# End-to-end T1 flow against a running portal: register -> event -> team -> project -> submit -> gallery.
set -u
B="${1:-http://localhost:3000}"
J="$(mktemp -d)"; fail=0
R="$RANDOM$RANDOM"
PW='FlowTest-Password-123'
json() { curl -s -H 'content-type: application/json' "$@"; }
code() { curl -s -o "$J/out" -w '%{http_code}' -H 'content-type: application/json' "$@"; }
check() { if [[ "$3" =~ ^$2$ ]]; then echo "PASS $1 ($3)"; else echo "FAIL $1 (expected $2, got $3)"; cat "$J/out" 2>/dev/null; echo; fail=1; fi; }
field() { python3 -c "import sys,json; d=json.load(sys.stdin); print(eval('d'+sys.argv[1]))" "$1"; }

reg() { check "register $1" 20[01] "$(code -c "$J/$1.jar" -d "{\"email\":\"$1-$R@flow.test\",\"password\":\"$PW\",\"displayName\":\"$1\"}" "$B/api/auth/register")"; }
reg org; reg p1; reg p2; reg p3

OPENS=$(date -u -d '-1 hour' +%Y-%m-%dT%H:%M:%SZ); CLOSES=$(date -u -d '+1 day' +%Y-%m-%dT%H:%M:%SZ)
check "create event" 201 "$(code -b "$J/org.jar" -d "{\"name\":\"Flow Test Event $R\",\"submissionOpensAt\":\"$OPENS\",\"submissionClosesAt\":\"$CLOSES\",\"maxTeamSize\":2}" "$B/api/events")"
EV=$(field "['event']['id']" < "$J/out")
check "draft event hidden from public" 404 "$(code "$B/api/events/$EV")"
check "non-organizer cannot publish" 403 "$(code -b "$J/p1.jar" -X PATCH -d '{"status":"published"}' "$B/api/events/$EV")"
check "publish event" 200 "$(code -b "$J/org.jar" -X PATCH -d '{"status":"published"}' "$B/api/events/$EV")"
check "create track" 201 "$(code -b "$J/org.jar" -d '{"name":"Main"}' "$B/api/events/$EV/tracks")"
TR=$(field "['track']['id']" < "$J/out")

check "create team" 201 "$(code -b "$J/p1.jar" -d "{\"eventId\":\"$EV\",\"name\":\"Team One\"}" "$B/api/teams")"
TEAM=$(field "['team']['id']" < "$J/out"); INV=$(field "['team']['inviteCode']" < "$J/out")
check "second team by same user rejected" 409 "$(code -b "$J/p1.jar" -d "{\"eventId\":\"$EV\",\"name\":\"Team Dup\"}" "$B/api/teams")"
check "join team" 200 "$(code -b "$J/p2.jar" -d "{\"inviteCode\":\"$INV\"}" "$B/api/teams/join")"
check "team cap enforced (max 2)" 409 "$(code -b "$J/p3.jar" -d "{\"inviteCode\":\"$INV\"}" "$B/api/teams/join")"

check "non-member cannot create project" 403 "$(code -b "$J/p3.jar" -d "{\"teamId\":\"$TEAM\",\"title\":\"x\",\"tagline\":\"x\",\"description\":\"x\"}" "$B/api/projects")"
check "create draft project" 201 "$(code -b "$J/p1.jar" -d "{\"teamId\":\"$TEAM\",\"trackId\":\"$TR\",\"title\":\"Flow Project $R\",\"tagline\":\"tag\",\"description\":\"desc\",\"repoUrl\":\"https://example.com/repo\",\"techTags\":[\"ts\"]}" "$B/api/projects")"
PR=$(field "['project']['id']" < "$J/out")
check "javascript: URL rejected" 400 "$(code -b "$J/p1.jar" -X PATCH -d '{"repoUrl":"javascript:alert(1)"}' "$B/api/projects/$PR")"
check "draft not in gallery" 200 "$(code "$B/api/gallery?q=Flow%20Project%20$R")"
grep -q "Flow Project $R" "$J/out" && { echo "FAIL draft leaked into gallery"; fail=1; } || echo "PASS draft not public"
check "teammate edits project" 200 "$(code -b "$J/p2.jar" -X PATCH -d '{"tagline":"edited"}' "$B/api/projects/$PR")"
check "submit project" 200 "$(code -b "$J/p2.jar" -X POST "$B/api/projects/$PR/submit")"
check "gallery search" 200 "$(code "$B/api/gallery?q=Flow%20Project%20$R")"
grep -q "Flow Project $R" "$J/out" && echo "PASS submitted project in gallery" || { echo "FAIL project missing from gallery"; fail=1; }

check "close event" 200 "$(code -b "$J/org.jar" -X PATCH -d '{"status":"closed"}' "$B/api/events/$EV")"
check "edit after close rejected" 403 "$(code -b "$J/p1.jar" -X PATCH -d '{"tagline":"late"}' "$B/api/projects/$PR")"
check "cannot reopen closed event" 409 "$(code -b "$J/org.jar" -X PATCH -d '{"status":"published"}' "$B/api/events/$EV")"

rm -rf "$J"; exit $fail
