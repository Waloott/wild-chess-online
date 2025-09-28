# Wild Chess EC2 Deployment Checklist

## Pre-Deployment
- [ ] AWS Account setup
- [ ] EC2 Key Pair created
- [ ] Security Group configured (ports 22, 80, 3000, 443)
- [ ] Code pushed to Git repository (recommended)

## EC2 Instance Setup
- [ ] Launch EC2 instance (Amazon Linux 2)
- [ ] Connect via SSH
- [ ] Run deployment script or manual setup

## Manual Deployment Steps (if not using deploy.sh)
```bash
# 1. Update system
sudo yum update -y

# 2. Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
sudo yum install -y nodejs

# 3. Install PM2
sudo npm install -g pm2

# 4. Create app directory
sudo mkdir -p /var/www/wild-chess
sudo chown ec2-user:ec2-user /var/www/wild-chess

# 5. Upload/Clone your code
cd /var/www/wild-chess
# Either: git clone your-repo .
# Or: upload and extract your tar.gz file

# 6. Install dependencies
npm install --production

# 7. Start with PM2
pm2 start ecosystem.config.js --env production
pm2 startup
pm2 save
```

## Post-Deployment
- [ ] Test application: http://your-ec2-ip:3000
- [ ] Set up domain name (optional)
- [ ] Configure SSL with Let's Encrypt (optional)
- [ ] Set up monitoring and logging
- [ ] Configure automatic backups

## Optional Enhancements
- [ ] Set up nginx reverse proxy
- [ ] Configure SSL certificate
- [ ] Set up CloudWatch monitoring
- [ ] Configure auto-scaling (if needed)

## Troubleshooting Commands
```bash
# Check application status
pm2 status
pm2 logs wild-chess

# Restart application
pm2 restart wild-chess

# Monitor real-time logs
pm2 logs wild-chess --lines 100 -f

# Check if port 3000 is listening
sudo netstat -tlnp | grep :3000

# Check security group allows port 3000
# (Do this in AWS Console)
```