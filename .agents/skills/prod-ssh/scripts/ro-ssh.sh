#!/usr/bin/env bash
# Read-only SSH to terln-studio production. This file is the command policy.
set -euo pipefail

HOST="216.167.70.247"
USER_NAME="root"
KEY="${HOME}/.ssh/id_ed25519"
COMPOSE_FILE="/opt/terln-studio/deploy/docker-compose.yml"
DRY=0

usage() {
  echo "usage: ro-ssh.sh [--dry-run] <command> [args...]" >&2
  exit 2
}

die() {
  echo "ro-ssh: $*" >&2
  exit 2
}

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY=1
  shift
fi
[[ $# -ge 1 ]] || usage

reject_meta() {
  local arg
  for arg in "$@"; do
    case "$arg" in
      *'`'*|*'$('*|*'>'*|*';'*|*'&'*|*'|'*|*$'\n'*)
        die "refusing shell metacharacter"
        ;;
    esac
  done
}

secret_path() {
  local lower
  lower=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
  case "$lower" in
    *.pem|*.key|*.env|*.env.*|*authorized_keys*|*credentials*|*id_rsa*|*id_ed25519*|*id_ecdsa*|*id_dsa*)
      return 0
      ;;
  esac
  return 1
}

reject_secret_paths() {
  local arg
  for arg in "$@"; do
    case "$arg" in
      */*)
        if secret_path "$arg"; then
          die "refusing to read secrets"
        fi
        ;;
    esac
  done
}

reject_follow() {
  local arg
  for arg in "$@"; do
    case "$arg" in
      -f|--follow|--follow=true|--follow=1)
        die "refusing follow mode"
        ;;
    esac
  done
}

require_last_abs_path() {
  local arg last=""
  for arg in "$@"; do
    case "$arg" in
      -*) ;;
      *) last=$arg ;;
    esac
  done
  case "$last" in
    /*) ;;
    *) die "refusing read without an absolute path" ;;
  esac
}

require_any_abs_path() {
  local arg
  for arg in "$@"; do
    case "$arg" in
      /*) return 0 ;;
    esac
  done
  die "refusing find without an absolute path"
}

check_find() {
  local arg
  for arg in "$@"; do
    case "$arg" in
      -delete|-exec|-execdir|-ok|-okdir|-fprint|-fls|-fprintf)
        die "refusing find action: $arg"
        ;;
    esac
  done
  require_any_abs_path "$@"
}

check_sed() {
  local arg
  for arg in "$@"; do
    case "$arg" in
      -i|--in-place|--in-place=*|-i*)
        die "refusing sed in-place"
        ;;
    esac
  done
}

check_http() {
  local arg url="" expect=""
  local kind="$1"
  shift
  for arg in "$@"; do
    if [[ -n "$expect" ]]; then
      case "$arg" in
        *[!0-9.]*) die "$kind option needs a number" ;;
      esac
      expect=""
      continue
    fi
    case "$arg" in
      -fsS|-f|-s|-S|-q|--fail|--silent|--show-error|--quiet|-4)
        ;;
      --max-time|-m|--connect-timeout|--retry|--retry-delay|--retry-max-time)
        expect=$arg
        ;;
      --max-time=*|--connect-timeout=*|--retry=*|--retry-delay=*|--retry-max-time=*|--timeout=*|--tries=*)
        ;;
      http://127.0.0.1:3000/api/health|http://127.0.0.1:3000/api/health/|http://localhost:3000/api/health|http://localhost:3000/api/health/)
        [[ -z "$url" ]] || die "$kind allows one URL"
        url=$arg
        ;;
      *)
        die "$kind argument not allowed"
        ;;
    esac
  done
  [[ -z "$expect" ]] || die "$kind option needs a value"
  [[ -n "$url" ]] || die "$kind only allows GET http://127.0.0.1:3000/api/health"
}

check_inspect_format() {
  local arg prev="" fmt="" have=0 lower
  for arg in "$@"; do
    case "$prev" in
      --format|-f)
        fmt=$arg
        have=1
        ;;
    esac
    prev=$arg
  done
  [[ "$have" == 1 ]] || die "docker inspect requires --format without Env"
  lower=$(printf '%s' "$fmt" | tr '[:upper:]' '[:lower:]')
  case "$lower" in
    *env*) die "docker inspect format cannot include Env" ;;
  esac
}

check_stats() {
  local arg ok=0
  for arg in "$@"; do
    [[ "$arg" == "--no-stream" ]] && ok=1
  done
  [[ "$ok" == 1 ]] || die "docker stats requires --no-stream"
}

check_compose() {
  local sub
  [[ $# -ge 3 ]] || die "docker compose requires -f, the compose file, and a subcommand"
  [[ "$1" == "-f" ]] || die "docker compose requires -f $COMPOSE_FILE"
  [[ "$2" == "$COMPOSE_FILE" ]] || die "docker compose file must be $COMPOSE_FILE"
  sub=$3
  shift 3
  case "$sub" in
    ps|top|images|port|version) ;;
    logs) reject_follow "$@" ;;
    *) die "docker compose subcommand not allowed" ;;
  esac
  reject_secret_paths "$@"
}

check_docker() {
  local sub="${1:-}"
  [[ -n "$sub" ]] || die "docker needs a subcommand"
  case "$sub" in
    -*) die "docker global options are not allowed" ;;
  esac
  shift
  case "$sub" in
    ps|top|port|images|info|version)
      ;;
    logs)
      reject_follow "$@"
      ;;
    stats)
      check_stats "$@"
      ;;
    image)
      [[ "${1:-}" == "ls" ]] || die "docker image only allows ls"
      shift
      ;;
    volume)
      case "${1:-}" in
        ls|inspect) ;;
        *) die "docker volume only allows ls or inspect" ;;
      esac
      shift
      ;;
    network)
      case "${1:-}" in
        ls|inspect) ;;
        *) die "docker network only allows ls or inspect" ;;
      esac
      shift
      ;;
    inspect)
      check_inspect_format "$@"
      ;;
    compose)
      check_compose "$@"
      ;;
    *)
      die "docker subcommand not allowed"
      ;;
  esac
  reject_secret_paths "$@"
}

check_sqlite() {
  local db="" arg sql="" dot first
  for arg in "$@"; do
    case "$arg" in
      -*) die "sqlite3 flags are not allowed" ;;
    esac
    if [[ -z "$db" ]]; then
      db=$arg
    else
      sql="${sql:+$sql }$arg"
    fi
  done
  case "$db" in
    file:*\?mode=ro|file:*\?mode=ro\&*|file:*\&mode=ro|file:*\&mode=ro\&*) ;;
    *) die "sqlite3 database must use a file: URI with mode=ro" ;;
  esac
  case "$db" in
    *mode=rw*) die "sqlite3 mode=rw is not allowed" ;;
  esac
  [[ -n "$sql" ]] || die "sqlite3 requires a query"
  if printf '%s' "$sql" | grep -Eiq 'password|secret|token|apikey|accesskey|privatekey'; then
    die "query references a secret column"
  fi
  case "$sql" in
    .*)
      dot=$(printf '%s' "$sql" | awk '{print $1}')
      case "$dot" in
        .tables|.schema|.indexes|.databases) ;;
        *) die "sqlite dot command not allowed" ;;
      esac
      ;;
    *)
      first=$(printf '%s' "$sql" | awk '{print toupper($1)}')
      case "$first" in
        SELECT|PRAGMA|EXPLAIN|WITH) ;;
        *) die "only read-only SQL is allowed" ;;
      esac
      ;;
  esac
}

base=$(basename -- "$1")
reject_meta "$@"

case "$base" in
  whoami|id|uname|uptime|date|hostname|dmesg|df|free|ps|ss|ls|stat|readlink|file|wc|du)
    reject_secret_paths "${@:2}"
    ;;
  sha256sum)
    require_last_abs_path "${@:2}"
    reject_secret_paths "${@:2}"
    ;;
  journalctl)
    reject_follow "${@:2}"
    reject_secret_paths "${@:2}"
    ;;
  find)
    check_find "${@:2}"
    reject_secret_paths "${@:2}"
    ;;
  cat|head|grep|awk)
    require_last_abs_path "${@:2}"
    reject_secret_paths "${@:2}"
    ;;
  tail)
    reject_follow "${@:2}"
    require_last_abs_path "${@:2}"
    reject_secret_paths "${@:2}"
    ;;
  sed)
    check_sed "${@:2}"
    require_last_abs_path "${@:2}"
    reject_secret_paths "${@:2}"
    ;;
  curl|wget)
    check_http "$base" "${@:2}"
    ;;
  docker)
    check_docker "${@:2}"
    ;;
  sqlite3)
    check_sqlite "${@:2}"
    ;;
  *)
    die "command not allowed"
    ;;
esac

if [[ "$DRY" == 1 ]]; then
  exit 0
fi

[[ -f "$KEY" ]] || die "default private key not found"

redact() {
  python3 -c '
import re, sys
key = "[A-Za-z0-9_]*(?:SECRET|PASSWORD|TOKEN|PRIVATE|ACCESS_KEY|API_KEY|DATABASE_URL|AUTHORIZATION)[A-Za-z0-9_]*"
pattern = re.compile("(" + key + ")(\\s*[=:]\\s*)\\S+", re.I)
bearer = re.compile("\\bbearer\\s+\\S+", re.I)
sk = re.compile("\\bsk-[A-Za-z0-9_-]+")
def repl(match):
    return match.group(1) + match.group(2) + "[redacted]"
for line in sys.stdin:
    line = bearer.sub("Bearer [redacted]", line)
    line = sk.sub("sk-[redacted]", line)
    line = pattern.sub(repl, line)
    sys.stdout.write(line)
'
}

ssh \
  -o BatchMode=yes \
  -o IdentitiesOnly=yes \
  -o IdentityFile="$KEY" \
  -o PreferredAuthentications=publickey \
  -o PubkeyAuthentication=yes \
  -o PasswordAuthentication=no \
  -o KbdInteractiveAuthentication=no \
  -o NumberOfPasswordPrompts=0 \
  -o StrictHostKeyChecking=accept-new \
  -o ConnectTimeout=10 \
  -l "$USER_NAME" \
  "$HOST" -- "$@" | redact
