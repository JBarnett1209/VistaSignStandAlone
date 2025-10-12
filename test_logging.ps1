# VistaSign Logging System Test Script
# Run this script to test the comprehensive logging system

Write-Host "Testing VistaSign Logging System..." -ForegroundColor Green

# Test 1: Generate test logs
Write-Host "`n1. Testing log generation endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://vistasign.unitvista.com/api/v1/logs/test" -Method GET -Headers @{"Accept"="application/json"}
    Write-Host "✅ Test logs generated successfully" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Failed to generate test logs: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Check health endpoint
Write-Host "`n2. Testing health endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://vistasign.unitvista.com/health" -Method GET
    Write-Host "✅ Health check passed" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Test documents endpoint (should generate logs)
Write-Host "`n3. Testing documents endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://vistasign.unitvista.com/api/v1/documents/test" -Method GET
    Write-Host "✅ Documents test endpoint responded" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Documents test failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nLogging system test completed!" -ForegroundColor Green
Write-Host "Check the backend logs to see the comprehensive logging in action." -ForegroundColor Cyan
