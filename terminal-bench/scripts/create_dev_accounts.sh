#!/usr/bin/env bash
#
# Create dev accounts for parallel terminal-bench runs.
# Uses the email OTP flow + captures OTP from PM2 backend logs.
#
# Usage: ./create_dev_accounts.sh [base_url]
#   base_url: defaults to http://localhost:4000
#
# Output: prints API keys for each account, and writes them to dev_api_keys.txt

set -euo pipefail

BASE_URL="${1:-http://localhost:4000}"
AUTH_URL="$BASE_URL/api/auth"
LOG_FILE="/home/hm/.pm2/logs/backend-out.log"

EMAILS=(
  "havlikmarcell+dev1@gmail.com"
  "havlikmarcell+dev2@gmail.com"
  "havlikmarcell+dev3@gmail.com"
  "havlikmarcell+dev4@gmail.com"
  "havlikmarcell+dev5@gmail.com"
  "havlikmarcell+dev6@gmail.com"
  "havlikmarcell+dev7@gmail.com"
  "havlikmarcell+dev8@gmail.com"
  "havlikmarcell+dev9@gmail.com"
)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_FILE="$SCRIPT_DIR/../dev_api_keys.txt"
> "$OUTPUT_FILE"

API_KEYS=()

for email in "${EMAILS[@]}"; do
  echo "=== Creating account: $email ==="

  # Record log position before OTP request
  LOG_SIZE=$(wc -c < "$LOG_FILE" 2>/dev/null || echo 0)

  # 1. Request OTP
  echo "  Requesting OTP..."
  curl -s -X POST "$AUTH_URL/email-otp/send-verification-otp" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$email\", \"type\": \"sign-in\"}" > /dev/null

  sleep 2

  # 2. Extract OTP from new log lines (after our request)
  # Escape + for grep
  ESCAPED_EMAIL="${email//+/\\+}"
  OTP=$(tail -c +"$((LOG_SIZE + 1))" "$LOG_FILE" 2>/dev/null | grep -oP "OTP Request:.*?for ${ESCAPED_EMAIL} with code \K[0-9]{6}" | tail -1)

  if [ -z "$OTP" ]; then
    # Fallback: search entire log file
    OTP=$(grep -oP "OTP Request:.*?for ${ESCAPED_EMAIL} with code \K[0-9]{6}" "$LOG_FILE" 2>/dev/null | tail -1)
  fi

  if [ -z "$OTP" ]; then
    echo "  ERROR: Could not find OTP for $email in backend logs"
    continue
  fi

  echo "  OTP: $OTP"

  # 3. Verify OTP → creates session
  echo "  Verifying OTP..."
  COOKIE_JAR=$(mktemp)
  RESPONSE=$(curl -s -c "$COOKIE_JAR" -X POST "$AUTH_URL/sign-in/email-otp" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$email\", \"otp\": \"$OTP\"}")

  # Check if sign-in succeeded
  if echo "$RESPONSE" | grep -q '"user"'; then
    echo "  Sign-in OK"
  else
    echo "  ERROR: Sign-in failed: $RESPONSE"
    rm -f "$COOKIE_JAR"
    continue
  fi

  # 4. Get API key using session cookie
  sleep 1
  COOKIES=$(grep -v '^#[^H]' "$COOKIE_JAR" | grep -v '^$' | awk '{printf "%s=%s; ", $6, $7}')

  # tRPC cookie endpoint
  API_KEY_RESPONSE=$(curl -s "$BASE_URL/trpc/cookie/apiKey.getDefault?batch=1&input=%7B%220%22%3A%7B%7D%7D" \
    -H "Cookie: $COOKIES")

  API_KEY=$(echo "$API_KEY_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    # tRPC batch response: [{result: {data: {id: ...}}}]
    if isinstance(data, list):
        result = data[0].get('result', {}).get('data', {})
    else:
        result = data.get('result', {}).get('data', data)
    print(result.get('id', ''))
except Exception as e:
    print('', file=sys.stderr)
" 2>/dev/null)

  if [ -z "$API_KEY" ]; then
    echo "  ERROR: Could not get API key. Response: $API_KEY_RESPONSE"
    rm -f "$COOKIE_JAR"
    continue
  fi

  echo "  API Key: $API_KEY"
  echo "$email=$API_KEY" >> "$OUTPUT_FILE"
  API_KEYS+=("$API_KEY")

  rm -f "$COOKIE_JAR"
  echo ""
done

echo "================================"
echo "Done! Created ${#API_KEYS[@]} accounts."
echo ""
echo "Keys saved to: $OUTPUT_FILE"
echo ""

# Print comma-separated for TODOFORAI_API_KEYS env var
if [ ${#API_KEYS[@]} -gt 0 ]; then
  KEYS_CSV=$(IFS=,; echo "${API_KEYS[*]}")
  echo "For terminal-bench parallel runs:"
  echo "  export TODOFORAI_API_KEYS=\"$KEYS_CSV\""
  echo ""
  echo "Or add to tbench.json:"
  echo "  \"api_keys\": [$(printf '"%s",' "${API_KEYS[@]}" | sed 's/,$//')]"
fi
