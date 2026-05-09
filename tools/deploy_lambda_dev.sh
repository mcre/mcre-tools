#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${TMPDIR:-/tmp}/mcre-tools-lambda-dev"
AWS_REGION="${AWS_REGION:-ap-northeast-1}"
AWS_PROFILE="${AWS_PROFILE:-mcre-main}"
LAMBDA_PREFIX="${LAMBDA_PREFIX:-mcre-tools-dev}"
LAMBDA_FUNCTIONS="${LAMBDA_FUNCTIONS:-${LAMBDA_PREFIX}-api ${LAMBDA_PREFIX}-ogp}"

aws_args=(--region "${AWS_REGION}")
if [ -n "${AWS_PROFILE}" ]; then
  aws_args+=(--profile "${AWS_PROFILE}")
fi

package_lambda() {
  local short_name="$1"
  local stage_dir="${BUILD_DIR}/${short_name}"
  local zip_file="${BUILD_DIR}/${short_name}.zip"

  rm -rf "${stage_dir}" "${zip_file}"
  mkdir -p "${stage_dir}"
  cp -R "${ROOT_DIR}/backend/lambda/src/${short_name}/." "${stage_dir}/"
  cp "${ROOT_DIR}/backend/lambda/src/util.py" "${stage_dir}/"

  if [ "${short_name}" = "api" ]; then
    cp -R "${ROOT_DIR}/backend/lambda/src/group_roulette_core" \
      "${stage_dir}/group_roulette_core"
  fi

  python3 -m py_compile $(find "${stage_dir}" -name "*.py" -type f | sort)

  (
    cd "${stage_dir}"
    zip -q -r "${zip_file}" .
  )

  echo "${zip_file}"
}

rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

for function_name in ${LAMBDA_FUNCTIONS//,/ }; do
  [ -n "${function_name}" ] || continue
  short_name="${function_name#${LAMBDA_PREFIX}-}"
  zip_file="$(package_lambda "${short_name}")"

  echo "Updating ${function_name} in ${AWS_REGION}..."
  aws lambda update-function-code \
    "${aws_args[@]}" \
    --function-name "${function_name}" \
    --zip-file "fileb://${zip_file}" \
    --query '{FunctionName:FunctionName,LastModified:LastModified,RevisionId:RevisionId}' \
    --output table

  echo "Waiting for ${function_name} update to finish..."
  aws lambda wait function-updated \
    "${aws_args[@]}" \
    --function-name "${function_name}"

  echo "Updated ${function_name}"
done

echo "Updated dev Lambda functions: ${LAMBDA_FUNCTIONS}"
