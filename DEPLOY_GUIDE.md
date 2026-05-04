# 🚀 Deploying CAPI to DigitalOcean (Minimum Cost)

This guide will help you deploy your Node.js application to a DigitalOcean Droplet for as low as **$4 - $6/month**.

---

## 1. Create a DigitalOcean Droplet
1. **Sign in** to [DigitalOcean](https://cloud.digitalocean.com/).
2. Click **Create** -> **Droplets**.
3. **Region**: Choose the one closest to your users.
4. **OS**: Choose **Ubuntu 22.04 (LTS)**.
5. **Droplet Type**: Select **Basic**.
6. **CPU Options**: Choose **Regular** and select the **$4/mo** or **$6/mo** plan (1GB RAM / 1 CPU).
7. **Authentication**: Choose **SSH Key** (Recommended) or **Password**.
8. **Finalize**: Click **Create Droplet**.

---

## 2. Connect to Your Server
Once the Droplet is ready, copy its **IP Address** and open your terminal (PowerShell or CMD):

```bash
ssh root@your_server_ip
```

---

## 3. Install Node.js & Tools
Run these commands one by one to set up the environment:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (Version 20)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (Process Manager to keep your app running 24/7)
sudo npm install -g pm2
```

---

## 4. Deploy Your Code
Clone your repository and install dependencies:

```bash
# Go to home directory
cd ~

# Clone your repo (Replace with your actual URL)
git clone https://github.com/awaiszubair/CAPI.git
cd CAPI

# Install dependencies
npm install
```

---

## 5. Configure Environment Variables
You need to create your `.env` file on the server.

```bash
nano .env
```
Paste your variables (Zoho, TikTok, WhatsApp tokens) into the editor. Press `CTRL + O`, `Enter` to save, and `CTRL + X` to exit.

---

## 6. Start the Application
Use PM2 to start your server so it stays alive even if you close the terminal:

```bash
# Start the app
pm2 start server.js --name "capi-server"

# Make it start automatically on server reboot
pm2 startup
# (Run the command PM2 gives you after the line above)
pm2 save
```

---

## 7. Open Firewall (Crucial)
Allow traffic on port 3000 so Meta/TikTok can reach your webhook:

```bash
sudo ufw allow 3000
sudo ufw allow ssh
sudo ufw enable
```

---

## 8. Access Your Webhook
Your webhook URL will now be:
`http://your_server_ip:3000/webhook/whatsapp`

### (Optional) Use Nginx for SSL (HTTPS)
If you need `https://`, you should point a domain to your IP and install Nginx + Certbot. For a simple "short" deployment, the IP version on port 3000 works for testing!

---

### Useful Commands
- **Check Logs**: `pm2 logs capi-server`
- **Restart App**: `pm2 restart capi-server`
- **Stop App**: `pm2 stop capi-server`
- **Check Status**: `pm2 status`
