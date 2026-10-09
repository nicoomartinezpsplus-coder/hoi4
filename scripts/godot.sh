#!/usr/bin/env bash
set -euo pipefail
tool_root="${IRONFRONT_GODOT_DIR:-/tmp/ironfront-godot}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$tool_root/cache}"
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$tool_root/config}"
export XDG_DATA_HOME="${XDG_DATA_HOME:-$tool_root/data}"
mkdir -p "$XDG_CACHE_HOME" "$XDG_CONFIG_HOME" "$XDG_DATA_HOME"
if [[ -x "$tool_root/bin/godot" ]]; then
  exec "$tool_root/bin/godot" "$@"
fi
exec godot "$@"
