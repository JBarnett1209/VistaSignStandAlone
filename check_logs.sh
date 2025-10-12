#!/bin/bash

# VistaSign Logs Checker Script
echo "VistaSign Logs Checker"
echo "====================="

# Step 1: Login
echo ""
echo "Step 1: Login to get access token"
read -p "Enter your email: " email
read -s -p "Enter your password: " password
echo ""

echo "Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "https://vistasign.unitvista.com/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$email\",\"password\":\"$password\"}")

# Extract access token
ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Login failed"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo "✅ Login successful!"
echo "Access token: ${ACCESS_TOKEN:0:20}..."

# Step 2: Check recent errors
echo ""
echo "Step 2: Checking recent errors..."
ERROR_LOGS=$(curl -s -X GET "https://vistasign.unitvista.com/api/v1/logs/recent-errors" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Accept: application/json")

echo "Recent errors:"
echo "$ERROR_LOGS" | jq '.[] | {timestamp, level, message, endpoint, method, exception_type}' 2>/dev/null || echo "$ERROR_LOGS"

# Step 3: Check all recent logs
echo ""
echo "Step 3: Checking all recent logs..."
ALL_LOGS=$(curl -s -X GET "https://vistasign.unitvista.com/api/v1/logs/?limit=10" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Accept: application/json")

echo "Recent logs:"
echo "$ALL_LOGS" | jq '.[] | {timestamp, level, message, endpoint, request_id}' 2>/dev/null || echo "$ALL_LOGS"

echo ""
echo "Logs check completed!"
