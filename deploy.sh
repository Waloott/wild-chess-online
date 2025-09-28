#!/bin/bash

# Wild Chess Deployment Script for EC2
# Run this script on your EC2 instance

# Update system
sudo yum update -y

# Install Node.js (using NodeSource repository for latest LTS)
curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
sudo yum install -y nodejs

# Install PM2 globally for process management
sudo npm install -g pm2

# Create application directory
sudo mkdir -p /var/www/wild-chess
sudo chown ec2-user:ec2-user /var/www/wild-chess

# Clone your repository (replace with your actual repo URL)
cd /var/www/wild-chess
# git clone https://github.com/yourusername/wild-chess.git .

# Install dependencies
npm install --production

# Set up PM2 to start on boot
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ec2-user --hp /home/ec2-user

# Start the application with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

echo "Wild Chess deployment completed!"
echo "Your application should be running on port 3000"