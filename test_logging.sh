#!/bin/bash

# VistaSign Logging System Test Script
# Run this script to test the comprehensive logging system

echo "Testing VistaSign Logging System..."

# Test 1: Generate test logs
echo ""
echo "1. Testing log generation endpoint..."
curl -X GET "https://vistasign.unitvista.com/api/v1/logs/test" \
  -H "Accept: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

# Test 2: Check health endpoint
echo ""
echo "2. Testing health endpoint..."
curl -X GET "https://vistasign.unitvista.com/health" \
  -H "Accept: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

# Test 3: Test documents endpoint (should generate logs)
echo ""
echo "3. Testing documents endpoint..."
curl -X GET "https://vistasign.unitvista.com/api/v1/documents/test" \
  -H "Accept: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo ""
echo "Logging system test completed!"
echo "Check the backend logs to see the comprehensive logging in action."
