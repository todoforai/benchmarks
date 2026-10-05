#!/usr/bin/env bash
# Build ~/cliproxyapi/config.yaml + ~/.cli-proxy-api/claude-bench.json for the bench proxy
# (fork Sixzero/CLIProxyAPI). Auth = Max subscription token from 'claude setup-token'
# (~/claude-oauth.env). That token is inference-only: /api/oauth/profile returns 403, so the
# account/org UUIDs are taken from the Windows Claude Code login (~/.claude.json) instead.
# Never prints secrets.
set -euo pipefail
mkdir -p ~/cliproxyapi ~/.cli-proxy-api
KEYFILE=~/cliproxyapi/client-key
[ -s "$KEYFILE" ] || { echo "sk-bench-$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')" > "$KEYFILE"; chmod 600 "$KEYFILE"; }
umask 077

python3 - <<'EOF'
import json, os, datetime
env = dict(l.strip().split("=", 1) for l in open(os.path.expanduser("~/claude-oauth.env")) if "=" in l)
acct = json.load(open("/mnt/c/Users/Six/.claude.json"))["oauthAccount"]
exp = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=360)).isoformat()
auth = {
    "type": "claude",
    "access_token": env["CLAUDE_CODE_OAUTH_TOKEN"],
    "email": acct["emailAddress"],
    "account_uuid": acct["accountUuid"],
    "organization_uuid": acct["organizationUuid"],
    "organization_name": acct.get("organizationName", ""),
    "expired": exp,
    "disabled": False,
}
p = os.path.expanduser("~/.cli-proxy-api/claude-bench.json")
json.dump(auth, open(p, "w"), indent=2)
os.chmod(p, 0o600)
EOF

cat > ~/cliproxyapi/config.yaml <<EOF
# Bench proxy. Docker containers reach it at 172.17.0.1:8317.
host: ""
port: 8317
auth-dir: "~/.cli-proxy-api"
api-keys:
  - "$(cat "$KEYFILE")"
debug: false
logging-to-file: true
request-retry: 3
max-retry-interval: 30
transient-error-cooldown-seconds: -1

# Without thinking.display Anthropic returns EMPTY thinking text (same rule as pc-6).
payload:
  default:
    - models:
        - name: "claude-*"
          protocol: "claude"
          exist:
            - "thinking.type"
          not-match:
            - "thinking.type": "disabled"
            - "thinking.type": "between_tools"
      params:
        "thinking.display": "summarized"

# Opus 5.5 requires >= 2.1.280.
claude-header-defaults:
  user-agent: "claude-cli/2.1.289 (external, cli)"
EOF
# Env for harbor codex agent (containers reach the proxy on the docker0 bridge).
printf "OPENAI_API_KEY=%s\nOPENAI_BASE_URL=http://172.17.0.1:8317/v1\n" "$(cat "$KEYFILE")" > ~/codex-cliproxy.env
echo "config + auth + ~/codex-cliproxy.env written"
