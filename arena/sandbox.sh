#!/usr/bin/env bash
# Lightweight sandbox (bubblewrap): host /usr read-only, /work = the run's work
# dir (only writable path), private /tmp + HOME, own PID namespace, no /home,
# no other runs visible. Host tools (blender, chrome, ffmpeg, rsvg) are reused
# — zero images to build. Needs the apparmor profile from README once.
#   ./sandbox.sh <workdir> -- <cmd...>
# The mayfly bridge runs bash in its default cwd $TMPDIR/todoforai, not --path
# (see pelican/RESULTS.md) → bind the work dir there too, so both paths are one dir.
# NOT isolated: network (the agent needs the API; host loopback is reachable),
# and the API key is readable via /proc inside — use dedicated bench keys only.
# Env passed through: TODOFORAI_API_TOKEN, TODOFORAI_API_URL, TFA_PROMPT.
set -euo pipefail; cd "$(dirname "$0")"
W=$(readlink -f "$1"); shift; [ "${1:-}" = -- ] && shift
DIST=$(readlink -f ../terminal-bench/todoforai_tbench/dist)
binds=(); for p in /snap /opt/google /etc/alternatives; do [ -e "$p" ] && binds+=(--ro-bind "$p" "$p"); done
# Snap wrappers need cgroups/snapd (fail in bwrap) → call the real binaries.
# (order matters: these come after --dev /dev / --tmpfs /run; resolv.conf → /run/systemd/resolve.)
# GPU passthrough (EEVEE/Cycles/WebGL): DRM render nodes + NVIDIA device nodes.
for g in /dev/dri /dev/nvidia*; do [ -e "$g" ] && binds+=(--dev-bind "$g" "$g"); done
# bun: modern JS runtime/bundler (host node is 18).
[ -x /snap/blender/current/blender ] && binds+=(--symlink /snap/blender/current/blender /tbin/blender)
BUN=$(command -v bun || true); [ -n "$BUN" ] && binds+=(--ro-bind "$(readlink -f "$BUN")" /tbin/bun --symlink bun /tbin/bunx)
exec bwrap --ro-bind /usr /usr --ro-bind /etc /etc \
  --symlink usr/lib /lib --symlink usr/lib64 /lib64 --symlink usr/bin /bin --symlink usr/sbin /sbin \
  --proc /proc --dev /dev --tmpfs /tmp --tmpfs /run --tmpfs /var --tmpfs /home \
  "${binds[@]}" --ro-bind-try /run/systemd/resolve /run/systemd/resolve \
  --dir /tmp/home --dir /tbin --bind "$W" /work --bind "$W" /tmp/todoforai --ro-bind "$DIST" /tfa --ro-bind "$PWD/rec" /rec --chdir /work \
  --unshare-pid --unshare-uts --unshare-ipc --die-with-parent --new-session \
  --clearenv --setenv HOME /tmp/home --setenv USER bench --setenv TERM xterm \
  --setenv PATH /tfa:/tbin:/usr/local/bin:/usr/bin:/bin \
  --setenv TODOFORAI_API_TOKEN "${TODOFORAI_API_TOKEN:-}" --setenv TODOFORAI_API_URL "${TODOFORAI_API_URL:-}" \
  --setenv TFA_PROMPT "${TFA_PROMPT:-}" \
  -- "$@"
