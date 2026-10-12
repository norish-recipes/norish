#!/bin/sh
# Docker creates a bind mount's missing host folder as root, which the server's
# unprivileged user cannot write (#116). Started as root, hand the uploads
# folder to that user, then run the server as it. Started as another user
# (compose `user:`), the folder is left as it is.
set -e

if [ "$(id -u)" = "0" ]; then
  uploads="${UPLOADS_DIR:-/app/uploads}"
  mkdir -p "$uploads"
  find "$uploads" ! -user "$NORISH_UID" -exec chown "$NORISH_UID:$NORISH_GID" {} + ||
    echo "Could not give $uploads to $NORISH_UID:$NORISH_GID; uploads may fail" >&2
  exec su-exec "$NORISH_UID:$NORISH_GID" "$@"
fi

exec "$@"
