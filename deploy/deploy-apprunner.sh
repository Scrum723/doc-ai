#!/usr/bin/env bash
# Deploy Doc AI to AWS App Runner. Requires AWS CLI + Docker.
# Live deploy is optional; this script is the hackathon artifact.
set -euo pipefail
REGION="${AWS_REGION:-us-east-1}"
NAME="${APP_RUNNER_SERVICE:-doc-ai}"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
REPO="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/${NAME}"

echo "Building image…"
docker build -t "${NAME}:latest" "$(dirname "$0")/.."

aws ecr describe-repositories --repository-names "${NAME}" --region "${REGION}" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "${NAME}" --region "${REGION}"

aws ecr get-login-password --region "${REGION}" | docker login --username AWS --password-stdin "${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"
docker tag "${NAME}:latest" "${REPO}:latest"
docker push "${REPO}:latest"

# Create or update App Runner service
if aws apprunner list-services --region "${REGION}" --query "ServiceSummaryList[?ServiceName=='${NAME}'].ServiceArn" --output text | grep -q .; then
  echo "Update existing App Runner service ${NAME}"
else
  aws apprunner create-service \
    --region "${REGION}" \
    --service-name "${NAME}" \
    --source-configuration "ImageRepository={ImageIdentifier=${REPO}:latest,ImageRepositoryType=ECR,ImageConfiguration={Port=8790}}" \
    --instance-configuration "Cpu=0.25 vCPU,Memory=0.5 GB"
fi
echo "Done. Set ALLOWED_ORIGINS to the App Runner HTTPS origin after first deploy."
echo "Request \$150 AWS credits via AWS Builder if needed: https://us-east-1.console.aws.amazon.com/costmanagement/home#/credits"
