#!/bin/bash

# Script to import existing AWS resources into Terraform state
# This is useful when resources were created manually or outside of Terraform
#
# Usage:
#   ./scripts/import-existing-resources.sh <stage> <region>
#
# Example:
#   ./scripts/import-existing-resources.sh dev ap-southeast-1

set -e

STAGE="${1:-dev}"
AWS_REGION="${2:-ap-southeast-1}"

if [ -z "$STAGE" ]; then
  echo "Error: Stage is required"
  echo "Usage: $0 <stage> [region]"
  exit 1
fi

echo "🔍 Importing existing resources for stage: $STAGE"
echo "Region: $AWS_REGION"
echo ""

cd terraform

# Initialize Terraform
echo "📦 Initializing Terraform..."
terraform init \
  -backend-config="bucket=flowgenie-terraform-state" \
  -backend-config="key=${STAGE}/terraform.tfstate" \
  -backend-config="region=${AWS_REGION}"

echo ""
echo "🔍 Checking for existing resources..."
echo ""

# Function to import App Runner VPC Connector
import_vpc_connector() {
  local CONNECTOR_ARN="$1"
  local MODULE_PATH="$2"
  
  if [ -z "$CONNECTOR_ARN" ]; then
    echo "⚠️  VPC Connector ARN not provided, skipping..."
    return
  fi
  
  echo "📥 Importing VPC Connector: $CONNECTOR_ARN"
  echo "   Module: $MODULE_PATH"
  
  terraform import "${MODULE_PATH}.aws_apprunner_vpc_connector.main[0]" "$CONNECTOR_ARN" || {
    echo "⚠️  Failed to import VPC Connector (may already be in state or not exist)"
  }
}

# Function to import Amplify App
import_amplify_app() {
  local APP_ID="$1"
  
  if [ -z "$APP_ID" ]; then
    echo "⚠️  Amplify App ID not provided, skipping..."
    return
  fi
  
  echo "📥 Importing Amplify App: $APP_ID"
  
  terraform import "module.amplify.aws_amplify_app.main" "$APP_ID" || {
    echo "⚠️  Failed to import Amplify App (may already be in state or not exist)"
  }
}

# Get existing VPC Connector ARN from error message or AWS CLI
echo "🔍 Checking for existing App Runner VPC Connectors..."
VPC_CONNECTORS=$(aws apprunner list-vpc-connectors --region "$AWS_REGION" --query 'VpcConnectors[*].[VpcConnectorArn, VpcConnectorName]' --output text 2>/dev/null || echo "")

if [ -n "$VPC_CONNECTORS" ]; then
  echo "Found existing VPC Connectors:"
  echo "$VPC_CONNECTORS"
  echo ""
  
  # Try to find connector with matching security groups
  # For now, we'll provide instructions for manual import
  echo "📝 To import VPC Connector, run:"
  echo "   terraform import module.app_runner.aws_apprunner_vpc_connector.main[0] <vpc-connector-arn>"
  echo "   terraform import module.app_runner_lambda_image.aws_apprunner_vpc_connector.main[0] <vpc-connector-arn>"
  echo ""
  echo "   Or if the second service should reuse the first connector, it's already configured to do so."
  echo ""
else
  echo "ℹ️  No existing VPC Connectors found"
fi

# Get existing Amplify App
echo "🔍 Checking for existing Amplify Apps..."
AMPLIFY_APPS=$(aws amplify list-apps --region "$AWS_REGION" --query "apps[?name=='${STAGE}-flowgenie-frontend'].[appId, name]" --output text 2>/dev/null || echo "")

if [ -n "$AMPLIFY_APPS" ]; then
  APP_ID=$(echo "$AMPLIFY_APPS" | head -1 | awk '{print $1}')
  echo "Found Amplify App: $APP_ID"
  echo ""
  echo "📝 To import Amplify App, run:"
  echo "   terraform import module.amplify.aws_amplify_app.main $APP_ID"
  echo ""
  echo "⚠️  Note: If there are manually deployed branches, you may need to delete them first"
  echo "   or configure the lifecycle to ignore repository changes (already done)."
else
  echo "ℹ️  No existing Amplify App found"
fi

echo ""
echo "✅ Import script completed"
echo ""
echo "📋 Next steps:"
echo "   1. Run the import commands shown above for any existing resources"
echo "   2. Run 'terraform plan' to see what changes Terraform wants to make"
echo "   3. Run 'terraform apply' to sync the state"
echo ""

