#!/bin/bash

# Create SSL directory
mkdir -p ssl

# Generate self-signed certificate for development
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/nginx-selfsigned.key \
    -out ssl/nginx-selfsigned.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=vistasign.unitvista.com"

echo "SSL certificates generated in ./ssl/"
echo "Note: These are self-signed certificates for development only."
