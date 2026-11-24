#!/usr/bin/env bash
# ============================================================
# Create macOS Desktop Shortcut (.command file)
# ============================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$HOME/Desktop"
COMMAND_FILE="$DESKTOP_DIR/Finance Tracker.command"

cat << 'EOF' > "$COMMAND_FILE"
#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EOF

echo "cd \"$SCRIPT_DIR\"" >> "$COMMAND_FILE"
echo "./run.sh" >> "$COMMAND_FILE"

chmod +x "$COMMAND_FILE"
chmod +x "$SCRIPT_DIR/run.sh"

echo "============================================================"
echo "  [SUCCESS] Created shortcut on Desktop!"
echo "  Location: $COMMAND_FILE"
echo "  You can double-click 'Finance Tracker.command' on your Desktop."
echo "============================================================"
