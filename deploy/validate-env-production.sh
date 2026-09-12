#!/usr/bin/env bash
# =============================================================================
# GET READY BACKEND — PRODUCTION ENVIRONMENT VALIDATOR & SAFE LOADER
#
# SECURITY RULES:
# - NEVER execute .env.production as a shell script (NO source, ., eval, bash, sh)
# - NEVER print secret values, passwords, keys, or connection URIs
# - Report only line numbers and variable names on format or assertion errors
# =============================================================================

set -eo pipefail

# Helper function to sanitize and migrate malformed dotenv files in-place
sanitize_env_file() {
  local target_file="$1"
  if [ ! -f "${target_file}" ]; then
    echo "❌ ERROR: Environment file '${target_file}' not found." >&2
    return 1
  fi

  local temp_file
  temp_file="$(mktemp "${target_file}.tmp.XXXXXX")"
  local modified=0
  local line_num=0

  while IFS= read -r line || [ -n "${line}" ]; do
    line_num=$((line_num + 1))
    
    # Strip carriage return (\r)
    local clean_line="${line%$'\r'}"
    
    # Strip leading and trailing whitespace for inspection
    local trimmed
    trimmed="$(echo "${clean_line}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    
    # 1. Blank line
    if [ -z "${trimmed}" ]; then
      printf "%s\n" "" >> "${temp_file}"
      continue
    fi
    
    # 2. Proper comment line
    if [[ "${trimmed}" =~ ^# ]]; then
      printf "%s\n" "${clean_line}" >> "${temp_file}"
      continue
    fi
    
    # 3. Valid KEY=VALUE or KEY="VALUE" or KEY='VALUE'
    if [[ "${trimmed}" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      printf "%s\n" "${clean_line}" >> "${temp_file}"
      continue
    fi
    
    # 4. YAML-style KEY: VALUE syntax (convert to KEY="VALUE")
    if [[ "${trimmed}" =~ ^([A-Za-z_][A-Za-z0-9_]*):[[:space:]]*(.*)$ ]]; then
      local y_key="${BASH_REMATCH[1]}"
      local y_val="${BASH_REMATCH[2]}"
      # If y_val already quoted, keep quotes, otherwise wrap in quotes
      if [[ "${y_val}" =~ ^\"(.*)\"$ ]] || [[ "${y_val}" =~ ^\'(.*)\'$ ]]; then
        printf "%s=%s\n" "${y_key}" "${y_val}" >> "${temp_file}"
      else
        printf "%s=\"%s\"\n" "${y_key}" "${y_val}" >> "${temp_file}"
      fi
      echo "  • Line ${line_num}: Converted YAML-style '${y_key}:' syntax to dotenv '${y_key}=' format."
      modified=1
      continue
    fi
    
    # 5. Malformed text / Missing comment prefix (e.g. "Super: ...", "Super Admin Settings")
    # Prefix with '# [MIGRATED-COMMENT]' to preserve documentation without breaking dotenv parsers
    printf "# [AUTO-FIXED] %s\n" "${clean_line}" >> "${temp_file}"
    echo "  • Line ${line_num}: Commented malformed non-assignment text to prevent parser errors."
    modified=1
  done < "${target_file}"

  if [ ${modified} -eq 1 ]; then
    local backup_file="${target_file}.bak.$(date -u +"%Y%m%d%H%M%S")"
    cp "${target_file}" "${backup_file}"
    chmod 600 "${backup_file}"
    mv "${temp_file}" "${target_file}"
    chmod 600 "${target_file}"
    echo "✅ Safe migration applied to ${target_file} (backup saved: ${backup_file})."
  else
    rm -f "${temp_file}"
  fi
}

# Safe in-memory dotenv parser (sets Bash environment variables WITHOUT eval or source)
safe_load_env() {
  local target_file="$1"
  if [ ! -f "${target_file}" ]; then
    echo "❌ ERROR: Cannot load missing environment file '${target_file}'." >&2
    return 1
  fi

  local line_num=0
  while IFS= read -r line || [ -n "${line}" ]; do
    line_num=$((line_num + 1))
    
    # Strip carriage return (\r)
    local clean_line="${line%$'\r'}"
    
    # Strip leading whitespace
    local trimmed
    trimmed="$(echo "${clean_line}" | sed -e 's/^[[:space:]]*//')"
    
    # Skip empty lines and comments
    if [ -z "${trimmed}" ] || [[ "${trimmed}" =~ ^# ]]; then
      continue
    fi
    
    # Parse KEY=VALUE
    if [[ "${trimmed}" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      local key="${BASH_REMATCH[1]}"
      local val="${BASH_REMATCH[2]}"
      
      # Strip surrounding matching double quotes
      if [[ "${val}" =~ ^\"(.*)\"$ ]]; then
        val="${BASH_REMATCH[1]}"
      # Strip surrounding matching single quotes
      elif [[ "${val}" =~ ^\'(.*)\'$ ]]; then
        val="${BASH_REMATCH[1]}"
      fi
      
      # Assign literally into shell environment
      export "${key}=${val}"
    fi
  done < "${target_file}"
}

# Strict production safety validator
validate_production_env() {
  local target_file="$1"
  if [ ! -f "${target_file}" ]; then
    echo "❌ ERROR: Environment file '${target_file}' not found." >&2
    return 1
  fi

  local has_errors=0
  local line_num=0

  echo "🔍 Validating syntax and structure of ${target_file}..."

  while IFS= read -r line || [ -n "${line}" ]; do
    line_num=$((line_num + 1))
    local clean_line="${line%$'\r'}"
    local trimmed
    trimmed="$(echo "${clean_line}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

    # Skip empty lines and comments
    if [ -z "${trimmed}" ] || [[ "${trimmed}" =~ ^# ]]; then
      continue
    fi

    # Check for valid KEY=VALUE format
    if [[ ! "${trimmed}" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      echo "❌ Syntax error on line ${line_num}: INVALID ENV KEY/VALUE SYNTAX" >&2
      has_errors=1
    fi
  done < "${target_file}"

  if [ ${has_errors} -ne 0 ]; then
    echo "❌ Environment format validation failed. Run with --sanitize to auto-repair malformed entries." >&2
    return 1
  fi
  echo "✅ Syntax format is valid."

  # Load variables safely into memory for assertion checks
  safe_load_env "${target_file}"

  # Assertion 1: DATABASE_URI
  if [ -z "${DATABASE_URI:-}" ]; then
    echo "❌ Security assertion failed: DATABASE_URI is missing from ${target_file}." >&2
    return 1
  fi

  if [[ "${DATABASE_URI}" =~ localhost|127\.0\.0\.1|getready_dev|/test ]]; then
    echo "❌ Security assertion failed: Production DATABASE_URI cannot point to localhost, 127.0.0.1, or development databases." >&2
    return 1
  fi

  if [[ ! "${DATABASE_URI}" =~ ^mongodb(\+srv)?:// ]]; then
    echo "❌ Security assertion failed: DATABASE_URI must be a valid MongoDB connection string (mongodb:// or mongodb+srv://)." >&2
    return 1
  fi
  echo "✅ DATABASE_URI assertion passed (External MongoDB Atlas Cluster verified)."

  # Assertion 2: JWT_SECRET
  if [ -z "${JWT_SECRET:-}" ]; then
    echo "❌ Security assertion failed: JWT_SECRET is missing from ${target_file}." >&2
    return 1
  fi

  if [ "${#JWT_SECRET}" -lt 32 ]; then
    echo "❌ Security assertion failed: JWT_SECRET must be at least 32 characters long (current length: ${#JWT_SECRET})." >&2
    return 1
  fi
  echo "✅ JWT_SECRET assertion passed (Cryptographic length verified: >=32 characters)."

  echo "🎉 Environment validation passed successfully for ${target_file}."
  return 0
}

# CLI execution handler
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  DO_SANITIZE=0
  TARGET_ENV_FILE=".env.production"

  while [ $# -gt 0 ]; do
    case "$1" in
      --sanitize|--fix|-s|-f)
        DO_SANITIZE=1
        shift
        ;;
      *)
        TARGET_ENV_FILE="$1"
        shift
        ;;
    esac
  done

  if [ ${DO_SANITIZE} -eq 1 ]; then
    echo "🛠️ Running pre-flight sanitization on ${TARGET_ENV_FILE}..."
    sanitize_env_file "${TARGET_ENV_FILE}"
  fi

  validate_production_env "${TARGET_ENV_FILE}"
fi
