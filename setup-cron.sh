#!/bin/bash

# Setup automatic certificate renewal with cron
# This script sets up a cron job to automatically renew Let's Encrypt certificates

echo "⏰ Setting up automatic certificate renewal..."

# Get the current directory
CURRENT_DIR=$(pwd)

# Create the cron job entry
CRON_ENTRY="0 2 * * * cd $CURRENT_DIR && ./renew-certs.sh >> /var/log/letsencrypt-renewal.log 2>&1"

# Add the cron job
echo "📝 Adding cron job for certificate renewal..."
(crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -

if [ $? -eq 0 ]; then
    echo "✅ Cron job added successfully!"
    echo "🔄 Certificates will be automatically renewed daily at 2:00 AM"
    echo "📋 Current cron jobs:"
    crontab -l
else
    echo "❌ Failed to add cron job"
    exit 1
fi

echo "🎉 Automatic certificate renewal setup completed!"
