# VistaSign API Token Creator Script
# This script helps you create an API token for accessing logs and other endpoints

Write-Host "VistaSign API Token Creator" -ForegroundColor Green
Write-Host "===========================" -ForegroundColor Green

# Step 1: Login
Write-Host "`nStep 1: Login to create API token" -ForegroundColor Yellow
$email = Read-Host "Enter your email"
$password = Read-Host "Enter your password" -AsSecureString
$password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))

$loginData = @{
    email = $email
    password = $password
} | ConvertTo-Json

Write-Host "Logging in..." -ForegroundColor Cyan
try {
    $loginResponse = Invoke-RestMethod -Uri "https://vistasign.unitvista.com/api/v1/auth/login" -Method POST -Body $loginData -ContentType "application/json"
    $accessToken = $loginResponse.access_token
    Write-Host "✅ Login successful!" -ForegroundColor Green
} catch {
    Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Create API token
Write-Host "`nStep 2: Creating API token..." -ForegroundColor Yellow
$tokenName = Read-Host "Enter a name for your API token (e.g., 'Debug Token')"
$scopes = @("read", "admin")  # Give admin scope for full access

$tokenData = @{
    name = $tokenName
    scopes = $scopes
    expires_days = 365  # Expires in 1 year
} | ConvertTo-Json

try {
    $headers = @{
        "Authorization" = "Bearer $accessToken"
        "Content-Type" = "application/json"
    }
    
    $tokenResponse = Invoke-RestMethod -Uri "https://vistasign.unitvista.com/api/v1/api-tokens/" -Method POST -Body $tokenData -Headers $headers
    
    Write-Host "✅ API token created successfully!" -ForegroundColor Green
    Write-Host "`n🔑 Your API Token:" -ForegroundColor Yellow
    Write-Host $tokenResponse.token -ForegroundColor Cyan -BackgroundColor Black
    Write-Host "`n⚠️  IMPORTANT: Save this token now! It won't be shown again." -ForegroundColor Red
    Write-Host "`n📋 Token Info:" -ForegroundColor Yellow
    Write-Host "Name: $($tokenResponse.token_info.name)" -ForegroundColor White
    Write-Host "Prefix: $($tokenResponse.token_info.token_prefix)" -ForegroundColor White
    Write-Host "Scopes: $($tokenResponse.token_info.scopes)" -ForegroundColor White
    Write-Host "Expires: $($tokenResponse.token_info.expires_at)" -ForegroundColor White
    
    # Step 3: Test the token
    Write-Host "`nStep 3: Testing API token..." -ForegroundColor Yellow
    $apiHeaders = @{
        "Authorization" = "Bearer $($tokenResponse.token)"
        "Accept" = "application/json"
    }
    
    try {
        $testResponse = Invoke-RestMethod -Uri "https://vistasign.unitvista.com/api/v1/logs/recent-errors" -Method GET -Headers $apiHeaders
        Write-Host "✅ API token test successful!" -ForegroundColor Green
        Write-Host "Retrieved $($testResponse.Count) recent errors" -ForegroundColor Cyan
    } catch {
        Write-Host "❌ API token test failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Failed to create API token: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.Exception.Response)" -ForegroundColor Gray
}

Write-Host "`nAPI token creation completed!" -ForegroundColor Green
Write-Host "You can now use this token to access the logs endpoint:" -ForegroundColor Cyan
Write-Host "curl -H 'Authorization: Bearer YOUR_TOKEN' https://vistasign.unitvista.com/api/v1/logs/" -ForegroundColor Gray
