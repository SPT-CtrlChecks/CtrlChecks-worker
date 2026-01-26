# AWS Deployment Guide - Ollama-First Architecture

## Overview

This guide covers deploying the CtrlChecks backend with Ollama on AWS, using the **best 3 models** optimized for cost and performance.

## Recommended Models

Based on your available models and AWS instance constraints:

1. **qwen2.5:3b** (1.9GB) - Fast, general purpose, multilingual
2. **codellama:7b** (3.8GB) - Code generation and analysis
3. **llava:latest** (4.7GB) - Multimodal/vision tasks

**Total: ~10.4GB** - Fits comfortably in most AWS GPU instances

## AWS Instance Recommendations

### Option 1: g4dn.xlarge (Recommended for Development)
- **GPU**: 1x NVIDIA T4 (16GB)
- **vCPU**: 4
- **RAM**: 16GB
- **Cost**: ~$0.526/hour (~$378/month)
- **Models**: All 3 recommended models fit comfortably
- **Use Case**: Development, testing, small production workloads

### Option 2: g4dn.2xlarge (Recommended for Production)
- **GPU**: 1x NVIDIA T4 (16GB)
- **vCPU**: 8
- **RAM**: 32GB
- **Cost**: ~$0.752/hour (~$541/month)
- **Models**: All 3 models + room for fallback models
- **Use Case**: Production workloads, higher concurrency

### Option 3: g5.xlarge (Best Performance)
- **GPU**: 1x NVIDIA A10G (24GB)
- **vCPU**: 4
- **RAM**: 16GB
- **Cost**: ~$1.006/hour (~$724/month)
- **Models**: All 3 models + multiple fallback models
- **Use Case**: High-performance production, larger models

## Deployment Steps

### 1. Launch EC2 Instance

```bash
# Using AWS CLI
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type g4dn.xlarge \
  --key-name your-key-name \
  --security-group-ids sg-xxxxxxxxx \
  --subnet-id subnet-xxxxxxxxx \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":50,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=ctrlchecks-ollama}]'
```

### 2. Install Docker and NVIDIA Container Toolkit

```bash
# SSH into instance
ssh -i your-key.pem ubuntu@<instance-ip>

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker
```

### 3. Install Ollama

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull recommended models
ollama pull qwen2.5:3b
ollama pull codellama:7b
ollama pull llava:latest

# Verify models
ollama list
```

### 4. Deploy Backend with Docker Compose

```bash
# Clone repository
git clone <your-repo-url>
cd ctrlchecks-ai-workflow-os

# Copy environment file
cp worker/.env.example worker/.env
# Edit worker/.env with your configuration

# Start services
docker-compose -f docker-compose.aws.yml up -d

# Check logs
docker-compose -f docker-compose.aws.yml logs -f
```

### 5. Configure Environment Variables

Create `worker/.env`:

```env
# Ollama
OLLAMA_HOST=http://ollama:11434

# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Server
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://your-frontend-domain.com

# Optional: Other API keys (not required with Ollama)
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
```

### 6. Verify Deployment

```bash
# Check Ollama health
curl http://localhost:11434/api/tags

# Check backend health
curl http://localhost:3001/health

# Test AI endpoint
curl -X POST http://localhost:3001/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello, how are you?", "model": "qwen2.5:3b"}'
```

## CloudFormation Template

See `infrastructure/terraform/ollama-ec2.tf` for Terraform configuration.

## Auto-Scaling Setup

For production, consider:

1. **Application Load Balancer** - Route traffic to multiple instances
2. **Auto Scaling Group** - Scale based on CPU/GPU utilization
3. **CloudWatch Alarms** - Monitor Ollama health and response times
4. **S3 for Model Storage** - Store models in S3 for faster instance startup

## Cost Optimization

1. **Use Spot Instances** - Save up to 90% on GPU instances
2. **Schedule Instances** - Stop instances during off-hours
3. **Model Caching** - Keep models loaded to reduce cold starts
4. **Request Batching** - Batch similar requests to improve throughput

## Monitoring

### CloudWatch Metrics

- Ollama response time
- Model usage statistics
- Error rates
- GPU utilization
- Request throughput

### Health Checks

```bash
# Backend health (includes Ollama status)
GET /health

# AI metrics
GET /api/ai/metrics

# Available models
GET /api/ai/models
```

## Security

1. **Security Groups** - Only allow necessary ports (3001, 11434)
2. **VPC** - Deploy in private subnets
3. **IAM Roles** - Use IAM roles instead of access keys
4. **SSL/TLS** - Use Application Load Balancer with SSL certificate
5. **Rate Limiting** - Implement rate limiting on API endpoints

## Troubleshooting

### Ollama Not Responding

```bash
# Check Ollama service
docker logs ctrlchecks-ollama

# Restart Ollama
docker restart ctrlchecks-ollama

# Check GPU availability
nvidia-smi
```

### Models Not Loading

```bash
# Check available disk space
df -h

# Check model files
docker exec ctrlchecks-ollama ls -lh /root/.ollama/models

# Pull missing models
docker exec ctrlchecks-ollama ollama pull qwen2.5:3b
```

### High Memory Usage

```bash
# Check memory usage
free -h

# Unload unused models
docker exec ctrlchecks-ollama ollama rm <model-name>
```

## Next Steps

1. Set up monitoring and alerting
2. Configure auto-scaling
3. Set up CI/CD pipeline
4. Implement request queuing for high load
5. Add model versioning and A/B testing
