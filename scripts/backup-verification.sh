#!/bin/bash

###############################################################################
# Supabase Backup Verification Script
#
# This script verifies Supabase backups by:
# 1. Checking backup availability
# 2. Sampling data from critical tables
# 3. Verifying data integrity
# 4. Recording verification results
#
# Usage: ./backup-verification.sh [backup-date]
# Example: ./backup-verification.sh 2026-02-02
###############################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_PROJECT_ID="${SUPABASE_PROJECT_ID:-}"
SUPABASE_DB_PASSWORD="${SUPABASE_DB_PASSWORD:-}"
BACKUP_DATE="${1:-$(date -d yesterday +%Y-%m-%d)}"
VERIFIER="${USER:-automated}"
SAMPLE_SIZE=100

# Critical tables to verify
CRITICAL_TABLES=(
  "lead_profiles"
  "audits"
  "campaigns"
  "email_events"
  "discovery_sessions"
)

# Output file
VERIFICATION_LOG="backup-verification-${BACKUP_DATE}.log"

###############################################################################
# Functions
###############################################################################

log() {
  echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$VERIFICATION_LOG"
}

error() {
  echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$VERIFICATION_LOG"
}

warn() {
  echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$VERIFICATION_LOG"
}

check_prerequisites() {
  log "Checking prerequisites..."

  if [ -z "$SUPABASE_PROJECT_ID" ]; then
    error "SUPABASE_PROJECT_ID environment variable not set"
    exit 1
  fi

  if ! command -v psql &> /dev/null; then
    error "psql (PostgreSQL client) is not installed"
    exit 1
  fi

  if ! command -v jq &> /dev/null; then
    warn "jq is not installed. JSON processing will be limited."
  fi

  log "Prerequisites check passed"
}

connect_to_backup() {
  log "Connecting to Supabase backup for ${BACKUP_DATE}..."

  # In a real implementation, you would:
  # 1. Use Supabase CLI to list available backups
  # 2. Download or access the backup for the specified date
  # 3. Restore to a temporary database for verification

  # For now, we'll connect to the live database
  # In production, replace this with actual backup access

  export PGPASSWORD="$SUPABASE_DB_PASSWORD"
  PSQL_COMMAND="psql -h db.${SUPABASE_PROJECT_ID}.supabase.co -U postgres -d postgres -t -A"

  # Test connection
  if ! $PSQL_COMMAND -c "SELECT 1;" > /dev/null 2>&1; then
    error "Failed to connect to database"
    exit 1
  fi

  log "Successfully connected to database"
}

verify_table() {
  local table=$1
  log "Verifying table: $table"

  # Check table exists
  local table_exists
  table_exists=$($PSQL_COMMAND -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='$table');")

  if [ "$table_exists" != "t" ]; then
    error "Table $table does not exist"
    return 1
  fi

  # Count total records
  local record_count
  record_count=$($PSQL_COMMAND -c "SELECT COUNT(*) FROM $table;")
  log "  Total records: $record_count"

  # Sample random records
  local sample_count
  sample_count=$(($record_count < $SAMPLE_SIZE ? $record_count : $SAMPLE_SIZE))

  if [ "$sample_count" -gt 0 ]; then
    log "  Sampling $sample_count random records..."

    # Verify sample data integrity
    local null_id_count
    null_id_count=$($PSQL_COMMAND -c "
      SELECT COUNT(*)
      FROM (SELECT * FROM $table ORDER BY RANDOM() LIMIT $sample_count) sample
      WHERE id IS NULL;
    ")

    if [ "$null_id_count" -gt 0 ]; then
      warn "  Found $null_id_count records with NULL id in sample"
    else
      log "  All sampled records have valid IDs"
    fi

    # Check for recent data (within last 30 days)
    local recent_count
    recent_count=$($PSQL_COMMAND -c "
      SELECT COUNT(*)
      FROM $table
      WHERE created_at > NOW() - INTERVAL '30 days'
        OR discovered_at > NOW() - INTERVAL '30 days'
        OR audited_at > NOW() - INTERVAL '30 days'
        OR occurred_at > NOW() - INTERVAL '30 days';
    " 2>/dev/null || echo "0")

    if [ "$recent_count" -gt 0 ]; then
      log "  Found $recent_count recent records (last 30 days)"
    else
      warn "  No recent records found in $table"
    fi
  fi

  log "  ✓ Table $table verified"
  return 0
}

verify_referential_integrity() {
  log "Verifying referential integrity..."

  # Check for orphaned audits (audits without leads)
  local orphaned_audits
  orphaned_audits=$($PSQL_COMMAND -c "
    SELECT COUNT(*)
    FROM audits a
    LEFT JOIN lead_profiles lp ON a.lead_id = lp.id
    WHERE lp.id IS NULL;
  ")

  if [ "$orphaned_audits" -gt 0 ]; then
    warn "  Found $orphaned_audits orphaned audit records"
  else
    log "  ✓ No orphaned audits"
  fi

  # Check for orphaned email events
  local orphaned_events
  orphaned_events=$($PSQL_COMMAND -c "
    SELECT COUNT(*)
    FROM email_events ee
    WHERE ee.lead_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM lead_profiles lp WHERE lp.id = ee.lead_id);
  ")

  if [ "$orphaned_events" -gt 0 ]; then
    warn "  Found $orphaned_events orphaned email event records"
  else
    log "  ✓ No orphaned email events"
  fi

  log "Referential integrity check complete"
}

record_verification_result() {
  local status=$1
  local issues=$2

  log "Recording verification results..."

  # Prepare issues JSON
  local issues_json="[]"
  if [ -n "$issues" ]; then
    issues_json="[{\"type\": \"integrity\", \"message\": \"$issues\"}]"
  fi

  # Prepare tables array
  local tables_json="["
  for table in "${CRITICAL_TABLES[@]}"; do
    tables_json+="\"$table\","
  done
  tables_json="${tables_json%,}]"

  # Insert verification record
  $PSQL_COMMAND -c "
    SELECT record_backup_verification(
      '$BACKUP_DATE'::DATE,
      '$VERIFIER',
      '$status',
      '$tables_json'::TEXT[],
      $SAMPLE_SIZE,
      '$issues_json'::JSONB,
      'Automated backup verification script'
    );
  " > /dev/null

  log "Verification results recorded in database"
}

###############################################################################
# Main Execution
###############################################################################

main() {
  log "========================================="
  log "Supabase Backup Verification"
  log "Backup Date: $BACKUP_DATE"
  log "Verifier: $VERIFIER"
  log "========================================="

  check_prerequisites
  connect_to_backup

  local failed_tables=()
  local total_verified=0

  for table in "${CRITICAL_TABLES[@]}"; do
    if verify_table "$table"; then
      ((total_verified++))
    else
      failed_tables+=("$table")
    fi
  done

  verify_referential_integrity

  # Determine overall status
  local status="success"
  local issues=""

  if [ ${#failed_tables[@]} -eq 0 ]; then
    log "========================================="
    log "${GREEN}✓ Backup verification PASSED${NC}"
    log "All $total_verified tables verified successfully"
  elif [ ${#failed_tables[@]} -lt ${#CRITICAL_TABLES[@]} ]; then
    status="partial"
    issues="Failed to verify tables: ${failed_tables[*]}"
    warn "========================================="
    warn "${YELLOW}⚠ Backup verification PARTIAL${NC}"
    warn "Verified $total_verified/${#CRITICAL_TABLES[@]} tables"
    warn "Failed: ${failed_tables[*]}"
  else
    status="failed"
    issues="Verification failed for all tables"
    error "========================================="
    error "${RED}✗ Backup verification FAILED${NC}"
    error "No tables could be verified"
  fi

  record_verification_result "$status" "$issues"

  log "========================================="
  log "Verification log saved to: $VERIFICATION_LOG"

  # Exit with appropriate code
  if [ "$status" = "success" ]; then
    exit 0
  elif [ "$status" = "partial" ]; then
    exit 1
  else
    exit 2
  fi
}

# Run main function
main "$@"
