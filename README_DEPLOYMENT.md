# CtrlChecks FastAPI Backend - Deployment Documentation

This directory contains the FastAPI backend for CtrlChecks and all deployment documentation.

---

## 📚 Documentation Index

1. **[DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md)** - Complete step-by-step deployment guide
   - GitHub repository setup
   - EC2 instance configuration
   - Application deployment
   - Systemd service setup
   - Nginx reverse proxy
   - SSL certificates
   - Verification procedures

2. **[FRONTEND_WIRING_GUIDE.md](./FRONTEND_WIRING_GUIDE.md)** - Frontend integration guide
   - Environment variable configuration
   - API endpoint reference
   - Authentication setup
   - CORS configuration
   - Error handling
   - Testing procedures

3. **[PRODUCTION_READINESS_CHECKLIST.md](./PRODUCTION_READINESS_CHECKLIST.md)** - Pre-production verification
   - Architecture review
   - Configuration verification
   - Security checklist
   - Performance validation
   - Frontend integration

4. **[README.md](./README.md)** - General application documentation
   - Architecture overview
   - Local development
   - Environment variables
   - API endpoints

---

## 🚀 Quick Start

### For First-Time Deployment

1. Read **[DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md)** completely
2. Follow steps 1-9 in order
3. Use **[PRODUCTION_READINESS_CHECKLIST.md](./PRODUCTION_READINESS_CHECKLIST.md)** to verify
4. Connect frontend using **[FRONTEND_WIRING_GUIDE.md](./FRONTEND_WIRING_GUIDE.md)**

### For Updates/Redeployment

1. See "Redeploy Procedure" section in **[DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md)**
2. Verify changes with health endpoint
3. Monitor logs for errors

### For Troubleshooting

1. Check "Troubleshooting" section in **[DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md)**
2. Review service logs: `sudo journalctl -u ctrlchecks -n 100`
3. Check Nginx logs: `sudo tail -50 /var/log/nginx/error.log`

---

## 📋 Essential Commands

```bash
# Service management
sudo systemctl status ctrlchecks
sudo systemctl restart ctrlchecks
sudo journalctl -u ctrlchecks -f

# Health check
curl https://api.yourdomain.com/health

# Update code
cd /opt/ctrlchecks/worker
git pull origin main
sudo systemctl restart ctrlchecks
```

---

## 🔑 Key Files

- **Application:** `/opt/ctrlchecks/worker/`
- **Environment:** `/opt/ctrlchecks/.env`
- **Service:** `/etc/systemd/system/ctrlchecks.service`
- **Nginx:** `/etc/nginx/sites-available/ctrlchecks`
- **Logs:** `journalctl -u ctrlchecks`

---

## 📞 Support

For issues or questions:
1. Check the troubleshooting section in the runbook
2. Review service logs
3. Verify configuration matches documentation

---

**Last Updated:** 2024-01-XX
