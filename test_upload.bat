@echo off
echo Testing document upload with comprehensive logging...

echo Creating test document...
echo This is a test document for VistaSign upload testing. > test_document.txt
echo Created on: %date% %time% >> test_document.txt
echo Purpose: Testing the document upload functionality with comprehensive logging. >> test_document.txt

echo.
echo Testing upload debug endpoint...
curl -X POST "https://vistasign.unitvista.com/test-upload" -F "file=@test_document.txt" -F "title=Test Document" -F "description=Test upload with logging"

echo.
echo Upload test completed!
echo Check the backend logs to see the comprehensive logging output.
pause
