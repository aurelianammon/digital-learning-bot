# SQLite Production Setup for Uberspace

## 1. Server Setup

### Create Data Directory
```bash
# SSH into your Uberspace server
ssh your-username@your-server.uberspace.de

# Create dedicated data directory
mkdir -p ~/data/digital-learning-bot
mkdir -p ~/data/digital-learning-bot/backups
mkdir -p ~/data/digital-learning-bot/uploads

# Set proper permissions
chmod 755 ~/data/digital-learning-bot
chmod 755 ~/data/digital-learning-bot/backups
chmod 755 ~/data/digital-learning-bot/uploads
```

## 2. Environment Configuration

Create `.env` file on your Uberspace server:

```bash
# Database - SQLite with absolute path
DATABASE_URL="file:/home/your-username/data/digital-learning-bot/production.db"

# Application
NODE_ENV="production"
PORT=3000

# Telegram Bot
TELEGRAM_KEY="your_telegram_bot_token_here"

# OpenAI
OPENAI_KEY="your_openai_api_key_here"

# HuggingFace
HF_ACCESS_TOKEN="your_huggingface_token_here"
```

## 3. Database Initialization

### First-time setup:
```bash
# Navigate to your app directory
cd ~/your-app-directory

# Generate Prisma client
bunx prisma generate

# Create the database and tables
bunx prisma db push

# Verify database was created
ls -la ~/data/digital-learning-bot/
```

## 4. File Permissions

Set proper permissions for security:

```bash
# Make database file readable/writable only by owner
chmod 600 ~/data/digital-learning-bot/production.db

# Ensure directory is accessible
chmod 755 ~/data/digital-learning-bot
```

## 5. Backup Strategy

### Create backup script:
```bash
#!/bin/bash
# backup-db.sh

BACKUP_DIR="/home/your-username/data/digital-learning-bot/backups"
DB_PATH="/home/your-username/data/digital-learning-bot/production.db"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create backup
cp "$DB_PATH" "$BACKUP_DIR/production_$TIMESTAMP.db"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "production_*.db" -mtime +7 -delete

echo "Database backed up to: $BACKUP_DIR/production_$TIMESTAMP.db"
```

### Set up cron job for automatic backups:
```bash
# Edit crontab
crontab -e

# Add this line for daily backups at 2 AM
0 2 * * * /home/your-username/backup-db.sh
```

## 6. Application Deployment

### Update your deployment process:

```bash
#!/bin/bash
# deploy.sh

echo "🚀 Deploying Digital Learning Bot..."

# Build the application
bun run build

# Generate Prisma client
bunx prisma generate

# Push database schema (creates tables if they don't exist)
bunx prisma db push

# Start the application
bun run start
```

## 7. Monitoring and Maintenance

### Check database status:
```bash
# Check if database exists and is accessible
ls -la ~/data/digital-learning-bot/production.db

# Check database size
du -h ~/data/digital-learning-bot/production.db

# Test database connection
sqlite3 ~/data/digital-learning-bot/production.db "SELECT name FROM sqlite_master WHERE type='table';"
```

### Database maintenance:
```bash
# Optimize database (run periodically)
sqlite3 ~/data/digital-learning-bot/production.db "VACUUM;"

# Check database integrity
sqlite3 ~/data/digital-learning-bot/production.db "PRAGMA integrity_check;"
```

## 8. Security Considerations

1. **File Permissions**: Database file should be 600 (read/write for owner only)
2. **Directory Permissions**: Data directory should be 755
3. **Backups**: Regular automated backups
4. **Access Control**: Limit SSH access to your Uberspace account

## 9. Troubleshooting

### Common Issues:

1. **Permission Denied**: Check file permissions
2. **Database Locked**: Ensure no other processes are using the database
3. **Disk Space**: Monitor available disk space
4. **Path Issues**: Use absolute paths in DATABASE_URL

### Debug Commands:
```bash
# Check current working directory
pwd

# Check environment variables
echo $DATABASE_URL

# Test database connection
bunx prisma db push --preview-feature
```

## 10. Performance Tips

1. **WAL Mode**: SQLite automatically uses WAL mode for better concurrency
2. **Regular VACUUM**: Run `VACUUM` periodically to optimize database
3. **Indexes**: Ensure proper indexes on frequently queried columns
4. **Connection Pooling**: Prisma handles this automatically

This setup will give you a robust SQLite-based production environment on Uberspace!