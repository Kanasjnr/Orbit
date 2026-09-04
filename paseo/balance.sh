#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/load-env.sh"
cd "$(dirname "$0")/../scripts"
exec npm run paseo:balance
