#!/bin/bash

# Let's Encrypt Initial Certificate Generation Script
# This script generates the initial Let's Encrypt certificates using AWS Route53

echo "🔐 Setting up Let's Encrypt certificates for VistaSign..."

# Check if required environment variables are set
if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ] || [ -z "$AWS_REGION" ] || [ -z "$SINGLE_HOSTNAME" ] || [ -z "$ACME_EMAIL" ]; then
    echo "❌ Missing required environment variables:"
    echo "   - AWS_ACCESS_KEY_ID"
    echo "   - AWS_SECRET_ACCESS_KEY" 
    echo "   - AWS_REGION"
    echo "   - SINGLE_HOSTNAME"
    echo "   - ACME_EMAIL"
    echo "Please set these in your .env file"
    exit 1
fi

echo "📋 Configuration:"
echo "   Domain: $SINGLE_HOSTNAME"
echo "   Email: $ACME_EMAIL"
echo "   AWS Region: $AWS_REGION"

# Create Let's Encrypt directories
echo "📁 Creating Let's Encrypt directories..."
mkdir -p letsencrypt_certs
mkdir -p letsencrypt_www

# Generate initial certificates
echo "🔐 Generating Let's Encrypt certificates..."
docker-compose run --rm certbot

# Check if certificate generation was successful
if [ $? -eq 0 ]; then
    echo "✅ Certificate generation successful!"
    
    # Start Nginx with Let's Encrypt certificates
    echo "🚀 Starting Nginx with Let's Encrypt certificates..."
    docker-compose up -d nginx
    
    if [ $? -eq 0 ]; then
        echo "✅ Nginx started successfully!"
        echo "🎉 VistaSign is now running with Let's Encrypt SSL certificates!"
        echo "🌐 Access your application at: https://$SINGLE_HOSTNAME"
    else
        echo "❌ Failed to start Nginx"
        exit 1
    fi
else
    echo "❌ Certificate generation failed!"
    echo "Please check your AWS credentials and domain configuration"
    exit 1
fi
