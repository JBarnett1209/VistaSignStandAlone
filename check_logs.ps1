# VistaSign Logs Checker Script
# This script helps you check the logs after getting authentication

Write-Host "VistaSign Logs Checker" -ForegroundColor Green
Write-Host "=====================" -ForegroundColor Green

# Step 1: Login
Write-Host "`nStep 1: Login to get access token" -ForegroundColor Yellow
$loginData = @{
    email = Read-Host "Enter your email"
    password = Read-Host "Enter your password" -AsSecureString
    password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))
} | ConvertTo-Json

Write-Host "Logging in..." -ForegroundColor Cyan
try {
    $loginResponse = Invoke-RestMethod -Uri "https://vistasign.unitvista.com/api/v1/auth/login" -Method POST -Body $loginData -ContentType "application/json"
    $accessToken = $loginResponse.access_token
    Write-Host "✅ Login successful!" -ForegroundColor Green
    Write-Host "Access token: $($accessToken.Substring(0, 20))..." -ForegroundColor Cyan
} catch {
    Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Check recent errors
Write-Host "`nStep 2: Checking recent errors..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $accessToken"
        "Accept" = "application/json"
    }
    
    $errorLogs = Invoke-RestMethod -Uri "https://vistasign.unitvista.com/api/v1/logs/recent-errors" -Method GET -Headers $headers
    Write-Host "✅ Retrieved $($errorLogs.Count) recent errors" -ForegroundColor Green
    
    foreach ($log in $errorLogs) {
        Write-Host "`n--- Error Log ---" -ForegroundColor Red
        Write-Host "Time: $($log.timestamp)" -ForegroundColor White
        Write-Host "Level: $($log.level)" -ForegroundColor Red
        Write-Host "Message: $($log.message)" -ForegroundColor White
        Write-Host "Endpoint: $($log.endpoint)" -ForegroundColor Yellow
        Write-Host "Method: $($log.method)" -ForegroundColor Yellow
        if ($log.exception_type) {
            Write-Host "Exception: $($log.exception_type)" -ForegroundColor Red
        }
        if ($log.extra_data) {
            Write-Host "Extra Data: $($log.extra_data | ConvertTo-Json -Compress)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "❌ Failed to get error logs: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 3: Check all recent logs
Write-Host "`nStep 3: Checking all recent logs..." -ForegroundColor Yellow
try {
    $allLogs = Invoke-RestMethod -Uri "https://vistasign.unitvista.com/api/v1/logs/?limit=20" -Method GET -Headers $headers
    Write-Host "✅ Retrieved $($allLogs.Count) recent logs" -ForegroundColor Green
    
    foreach ($log in $allLogs) {
        $color = switch ($log.level) {
            "ERROR" { "Red" }
            "WARNING" { "Yellow" }
            "INFO" { "Green" }
            default { "White" }
        }
        
        Write-Host "`n--- $($log.level) Log ---" -ForegroundColor $color
        Write-Host "Time: $($log.timestamp)" -ForegroundColor White
        Write-Host "Message: $($log.message)" -ForegroundColor White
        Write-Host "Endpoint: $($log.endpoint)" -ForegroundColor Yellow
        Write-Host "Request ID: $($log.request_id)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "❌ Failed to get all logs: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nLogs check completed!" -ForegroundColor Green
