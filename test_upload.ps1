# Test document upload with comprehensive logging
Write-Host "Testing document upload with comprehensive logging..." -ForegroundColor Green

# Create a test file
$testContent = @"
This is a test document for VistaSign upload testing.
Created on: $(Get-Date)
Purpose: Testing the document upload functionality with comprehensive logging.

The upload should work now with our enhanced debugging and logging system.
"@

$testContent | Out-File -FilePath "test_document.txt" -Encoding UTF8

Write-Host "Created test_document.txt" -ForegroundColor Yellow

# Test the upload debug endpoint
Write-Host "`nTesting upload debug endpoint..." -ForegroundColor Yellow
try {
    # Use curl for file upload (more reliable than PowerShell for multipart forms)
    $curlCommand = 'curl -X POST "https://vistasign.unitvista.com/api/v1/documents/upload-debug" -F "file=@test_document.txt" -F "title=Test Document" -F "description=Test upload with logging"'
    Write-Host "Running: $curlCommand" -ForegroundColor Cyan
    
    # Execute curl command
    Invoke-Expression $curlCommand
} catch {
    Write-Host "❌ Upload debug test failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nUpload test completed!" -ForegroundColor Green
Write-Host "Check the backend logs to see the comprehensive logging output." -ForegroundColor Cyan
