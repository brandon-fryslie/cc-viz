#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOC_FILE="$ROOT_DIR/docs/deferred-tests.md"

if [[ ! -f "$DOC_FILE" ]]; then
  echo "missing deferred test doc: $DOC_FILE" >&2
  exit 1
fi

mapfile -t test_files < <(find "$ROOT_DIR/internal" -name '*_test.go' -type f | sort)
mapfile -t deferred_tests < <(
  awk '
    /^func Test/ {
      name=$2
      sub(/\(.*/, "", name)
      current=name
    }
    /t\.Skip\("deferred:/ {
      if (current != "") print current
    }
  ' "${test_files[@]}" 2>/dev/null | sort -u
)

status=0
for test_name in "${deferred_tests[@]}"; do
  if ! grep -q "$test_name" "$DOC_FILE"; then
    echo "deferred test missing from docs/deferred-tests.md: $test_name" >&2
    status=1
  fi
done

if [[ $status -ne 0 ]]; then
  exit $status
fi

echo "deferred test documentation is in sync"
