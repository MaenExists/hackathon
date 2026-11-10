#!/bin/sh
sh "$(dirname "$0")/Start-Unix.sh"
COLLECTOR_EXIT=$?
if [ "$COLLECTOR_EXIT" -ne 0 ]; then printf '\nPress Enter to close.'; read -r COLLECTOR_INPUT; fi
exit "$COLLECTOR_EXIT"
