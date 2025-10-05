#!/bin/bash

# Let's Encrypt Certificate Renewal Script
# This script automatically renews certificates and reloads Nginx

echo "🔄 Starting certificate renewal process..."

# Check if certificates exist
if [ ! -d "/etc/letsencrypt/live/vistasign.unitvista.com" ]; then
    echo "❌ No certificates found. Please run initial certificate generation first."
    exit 1
fi

# Renew certificates
echo "📜 Renewing Let's Encrypt certificates..."
docker-compose run --rm certbot renew

# Check if renewal was successful
if [ $? -eq 0 ]; then
    echo "✅ Certificate renewal successful!"
    
    # Reload Nginx to use new certificates
    echo "🔄 Reloading Nginx configuration..."
    docker-compose exec nginx nginx -s reload
    
    if [ $? -eq 0 ]; then
        echo "✅ Nginx reloaded successfully!"
    else
        echo "❌ Failed to reload Nginx"
        exit 1
    fi
else
    echo "❌ Certificate renewal failed!"
    exit 1
fi

echo "🎉 Certificate renewal process completed successfully!"
