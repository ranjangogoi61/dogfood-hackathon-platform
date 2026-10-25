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
reg org; reg p1; reg p2; reg p3; reg j1

OPENS=$(date -u -d '-1 hour' +%Y-%m-%dT%H:%M:%SZ); CLOSES=$(date -u -d '+1 day' +%Y-%m-%dT%H:%M:%SZ)
check "create event" 201 "$(code -b "$J/org.jar" -d "{\"name\":\"Flow Test Event $R\",\"submissionOpensAt\":\"$OPENS\",\"submissionClosesAt\":\"$CLOSES\",\"judgingOpensAt\":\"$OPENS\",\"judgingClosesAt\":\"$CLOSES\",\"maxTeamSize\":2}" "$B/api/events")"
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

# ---- T2: judges, rubric, assignments, scores, export ----
check "invite judge" 201 "$(code -b "$J/org.jar" -d "{\"email\":\"j1-$R@flow.test\"}" "$B/api/events/$EV/judges")"
check "participant cannot invite judges" 403 "$(code -b "$J/p1.jar" -d "{\"email\":\"j1-$R@flow.test\"}" "$B/api/events/$EV/judges")"
check "set rubric" 200 "$(code -b "$J/org.jar" -X PUT -d '{"criteria":[{"name":"Idea","weight":2,"maxScore":10},{"name":"Build","weight":1,"maxScore":5}]}' "$B/api/events/$EV/rubric")"
RC1=$(field "['criteria'][0]['id']" < "$J/out"); RC2=$(field "['criteria'][1]['id']" < "$J/out")
check "auto-assign judges" 201 "$(code -b "$J/org.jar" -d '{"auto":{"judgesPerProject":1}}' "$B/api/events/$EV/assignments")"
grep -q '"created":1' "$J/out" && echo "PASS 1 assignment created" || { echo "FAIL expected created:1"; cat "$J/out"; fail=1; }
check "judge lists assignments" 200 "$(code -b "$J/j1.jar" "$B/api/judging/assignments")"
AS=$(field "['assignments'][0]['assignmentId']" < "$J/out")
check "score out of range rejected" 422 "$(code -b "$J/j1.jar" -d "{\"assignmentId\":\"$AS\",\"scores\":[{\"criterionId\":\"$RC2\",\"value\":6}]}" "$B/api/judging/scores")"
check "judge submits scores" 200 "$(code -b "$J/j1.jar" -d "{\"assignmentId\":\"$AS\",\"scores\":[{\"criterionId\":\"$RC1\",\"value\":10},{\"criterionId\":\"$RC2\",\"value\":5}]}" "$B/api/judging/scores")"
check "rubric locked after scoring" 409 "$(code -b "$J/org.jar" -X PUT -d '{"criteria":[{"name":"X","weight":1,"maxScore":10}]}' "$B/api/events/$EV/rubric")"
check "progress (organizer)" 200 "$(code -b "$J/org.jar" "$B/api/events/$EV/progress")"
check "progress blocked for judge" 403 "$(code -b "$J/j1.jar" "$B/api/events/$EV/progress")"
check "export (organizer)" 200 "$(curl -s -o "$J/out" -w '%{http_code}' -b "$J/org.jar" "$B/api/events/$EV/export")"
grep -q ",submitted,1,100.0000,100.0000" "$J/out" && echo "PASS export has expected scaled score (100)" || { echo "FAIL export content"; cat "$J/out"; fail=1; }

rm -rf "$J"; exit $fail
