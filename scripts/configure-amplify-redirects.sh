#!/bin/bash

# Script to configure AWS Amplify rewrites and redirects for SPA routing
# This script configures Amplify to redirect all routes to index.html for client-side routing
#
# Usage:
#   ./scripts/configure-amplify-redirects.sh <app-id> <branch-name> [region]
#
# Example:
#   ./scripts/configure-amplify-redirects.sh d1234567890abcdef main us-east-1

set -e

APP_ID="${1}"
BRANCH_NAME="${2:-main}"
AWS_REGION="${3:-us-east-1}"

if [ -z "$APP_ID" ]; then
  echo "Error: App ID is required"
  echo "Usage: $0 <app-id> <branch-name> [region]"
  echo ""
  echo "To find your App ID:"
  echo "  1. Go to AWS Amplify Console"
  echo "  2. Select your app"
  echo "  3. The App ID is shown in the app details"
  exit 1
fi

echo "Configuring Amplify rewrites and redirects..."
echo "App ID: $APP_ID"
echo "Branch: $BRANCH_NAME"
echo "Region: $AWS_REGION"
echo ""

# Create a custom rewrite rule for SPA routing
# This regex matches all routes that don't have file extensions (css, js, images, etc.)
# and rewrites them to /index.html with a 200 status code
REWRITE_RULE=$(cat <<EOF
{
  "source": "</^[^.]+$|.(?!(css|gif|ico|jpg|jpeg|js|png|txt|svg|woff|woff2|ttf|map|json|webp|woff2|eot)$)([^.]+$)/>",
  "target": "/index.html",
  "status": "200",
  "type": "REWRITE"
}
EOF
)

echo "Creating rewrite rule via AWS CLI..."
echo "Rule: $REWRITE_RULE"
echo ""

# Use AWS CLI to update the Amplify app's custom rules
# Note: This requires AWS CLI v2 and appropriate IAM permissions
aws amplify update-app \
  --app-id "$APP_ID" \
  --region "$AWS_REGION" \
  --custom-rules "$REWRITE_RULE" \
  --output json

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Successfully configured Amplify rewrite rule!"
  echo ""
  echo "The rewrite rule will:"
  echo "  - Redirect all routes (except static assets) to /index.html"
  echo "  - Return HTTP 200 status (rewrite, not redirect)"
  echo "  - Allow React Router to handle client-side routing"
  echo ""
  echo "You may need to trigger a new deployment for the changes to take effect."
else
  echo ""
  echo "❌ Failed to configure rewrite rule"
  echo ""
  echo "Alternative: Configure manually in AWS Amplify Console:"
  echo "  1. Go to: https://console.aws.amazon.com/amplify/"
  echo "  2. Select your app: $APP_ID"
  echo "  3. Go to: App Settings > Rewrites and Redirects"
  echo "  4. Add rule:"
  echo "     - Source: </^[^.]+$|.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>"
  echo "     - Target: /index.html"
  echo "     - Type: 200 (Rewrite)"
  exit 1
fi

