#!/usr/bin/env bash
# dashboard.sh — Live visual dashboard for run-tasks.sh
# Usage: ./dashboard.sh [prd-file] [refresh-seconds]
#   ./dashboard.sh docs/prd-v1-refinement.md 3

PRD="${1:-docs/prd-v1-refinement.md}"
INTERVAL="${2:-3}"
LOG_DIR="./task-logs"

# Colors
RESET="\033[0m"
BOLD="\033[1m"
DIM="\033[2m"
GREEN="\033[32m"
RED="\033[31m"
YELLOW="\033[33m"
BLUE="\033[34m"
CYAN="\033[36m"
WHITE="\033[37m"
BG_GREEN="\033[42m"
BG_RED="\033[41m"
BG_BLUE="\033[44m"
BG_DARK="\033[48;5;236m"

bar() {
  local pct=$1 width=$2 filled empty
  filled=$((pct * width / 100))
  empty=$((width - filled))
  printf "${BG_GREEN}${BOLD}"
  printf '%*s' "$filled" '' | tr ' ' ' '
  printf "${RESET}${BG_DARK}"
  printf '%*s' "$empty" '' | tr ' ' ' '
  printf "${RESET}"
}

while true; do
  clear

  # Counts
  done_count=$(grep -c '^\- \[x\]' "$PRD" 2>/dev/null || echo 0)
  fail_count=$(grep -c '^\- \[!\]' "$PRD" 2>/dev/null || echo 0)
  pending_count=$(grep -c '^\- \[ \]' "$PRD" 2>/dev/null || echo 0)
  total=$((done_count + fail_count + pending_count))

  if [ "$total" -gt 0 ]; then
    pct=$((done_count * 100 / total))
  else
    pct=0
  fi

  # Find currently running task (last log file being written)
  current_log=$(ls -t "$LOG_DIR"/*.log 2>/dev/null | head -1)
  current_task=""
  if [ -n "$current_log" ]; then
    current_size=$(wc -c < "$current_log" 2>/dev/null | tr -d ' ')
    current_name=$(basename "$current_log" | sed 's/^task-[0-9]*-//' | sed 's/-[0-9]*\.log$//' | tr '-' ' ' | cut -c1-60)
  fi

  # Calculate elapsed time from first log
  first_log=$(ls -tr "$LOG_DIR"/*.log 2>/dev/null | head -1)
  if [ -n "$first_log" ]; then
    first_time=$(stat -f %m "$first_log" 2>/dev/null || echo 0)
    now=$(date +%s)
    elapsed=$((now - first_time))
    elapsed_min=$((elapsed / 60))
    elapsed_sec=$((elapsed % 60))
  else
    elapsed_min=0
    elapsed_sec=0
  fi

  # Estimate remaining
  completed=$((done_count + fail_count))
  if [ "$completed" -gt 0 ] && [ "$pending_count" -gt 0 ]; then
    avg_sec=$((elapsed / completed))
    remaining_sec=$((avg_sec * pending_count))
    remaining_min=$((remaining_sec / 60))
  else
    remaining_min="?"
  fi

  # Header
  echo ""
  printf "  ${BOLD}${CYAN}REDIAL v1.0 — OVERNIGHT TASK RUNNER${RESET}\n"
  printf "  ${DIM}Elapsed: ${elapsed_min}m ${elapsed_sec}s | Est. remaining: ${remaining_min}m${RESET}\n"
  echo ""

  # Progress bar
  printf "  "
  bar "$pct" 40
  printf "  ${BOLD}%d%%${RESET}\n" "$pct"
  echo ""

  # Scoreboard
  printf "  ${GREEN}${BOLD} DONE  ${RESET} ${GREEN}${done_count}${RESET}"
  printf "    ${RED}${BOLD} FAIL  ${RESET} ${RED}${fail_count}${RESET}"
  printf "    ${DIM} QUEUE ${RESET} ${DIM}${pending_count}${RESET}"
  printf "    ${BOLD} TOTAL ${RESET} ${total}\n"
  echo ""

  # Task list with status
  printf "  ${BOLD}${WHITE}%-4s %-6s %-62s %s${RESET}\n" "#" "PRI" "TASK" "STATUS"
  printf "  ${DIM}─────────────────────────────────────────────────────────────────────────────${RESET}\n"

  task_num=0
  while IFS= read -r line; do
    task_num=$((task_num + 1))

    # Extract priority
    pri=$(echo "$line" | grep -o '\*\*P[0-2]\*\*' | tr -d '*')

    # Extract task summary (first ~55 chars of meaningful text)
    summary=$(echo "$line" | sed 's/^- \[.\] \*\*P[0-2]\*\* //' | cut -c1-58)

    # Determine status
    if echo "$line" | grep -q '^\- \[x\]'; then
      status="${GREEN}DONE${RESET}"
      pri_color="${GREEN}"
    elif echo "$line" | grep -q '^\- \[!\]'; then
      status="${RED}FAIL${RESET}"
      pri_color="${RED}"
    else
      # Is this the next pending one? (first [ ] = running)
      if [ "$task_num" -eq $((completed + 1)) ]; then
        status="${YELLOW}>>>>${RESET}"
        pri_color="${YELLOW}"
      else
        status="${DIM}----${RESET}"
        pri_color="${DIM}"
      fi
    fi

    printf "  ${pri_color}%-4s %-6s${RESET} %-58s %b\n" "$task_num" "$pri" "$summary" "$status"

    # Show max 20 rows, then summarize
    if [ "$task_num" -eq 20 ] && [ "$total" -gt 20 ]; then
      remaining_rows=$((total - 20))
      printf "  ${DIM}     ... +${remaining_rows} more tasks ...${RESET}\n"
      break
    fi
  done < <(grep '^\- \[' "$PRD")

  echo ""
  printf "  ${DIM}─────────────────────────────────────────────────────────────────────────────${RESET}\n"

  # Recent log activity
  if [ -n "$current_log" ]; then
    printf "  ${BOLD}Latest log:${RESET} ${DIM}$(basename "$current_log") (${current_size} bytes)${RESET}\n"
    last_line=$(tail -1 "$current_log" 2>/dev/null | cut -c1-75)
    if [ -n "$last_line" ]; then
      printf "  ${DIM}> ${last_line}${RESET}\n"
    fi
  fi

  printf "\n  ${DIM}Refreshing every ${INTERVAL}s — Ctrl+C to exit${RESET}\n"

  sleep "$INTERVAL"
done
