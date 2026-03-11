# Virpanix Backend

The robust Node.js backend for the Virpanix platform, featuring a containerized architecture, integrated database management, and automated AWS deployment.

## 🚀 Key Features

- **Containerized Implementation**: Multi-stage `Dockerfile` and `docker-compose` for consistent environments.
- **YugabyteDB Integration**: High-performance, distributed SQL database support with automated EBS mounting for persistence.
- **Secure Architecture**: Designed to run in private subnets with traffic routed via an Application Load Balancer (ALB).
- **Automated CI/CD**: Seamless GitHub Actions pipeline for testing, security scanning, and deployment via Bastion jump host.

## 🛠️ Local Development Setup

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v20 or later)
- [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)
- [Git](https://git-scm.com/)

### 2. Environment Configuration
Clone the repository and create a `.env` file based on the example:
```bash
cp env.example .env
```
Update the `.env` file with your local database credentials and API keys.

### 3. Running with Docker (Recommended)
Launch the API and YugabyteDB in one command:
```bash
docker-compose up -d
```
The API will be available at `http://localhost:3001`.

### 4. Direct Node.js Execution
```bash
npm install
npm run dev
```

## 🏗️ Architecture & Infrastructure

The application is deployed on AWS using a secure multi-tier networking model:
- **Public Layer**: ALB and Bastion Host.
- **Private Layer**: Backend EC2 instance and YugabyteDB.
- **Storage**: Dedicated 20GB gp3 EBS volume mounted at `/mnt/yugabyte-data`.

For full infrastructure details, see the [Infrastructure Repository](https://github.com/virpanix/virpanix-iac).

## 🤖 CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/backend-pipeline.yml`) automates the following stages:

### CI (Continuous Integration)
- **Lint**: `npm run lint`
- **Security**: Security vulnerability check for dependencies.
- **Test**: Automated unit tests.
- **Verify**: Build check of the Docker image.

### CD (Continuous Deployment)
- **Build & Push**: Builds the production image and pushes it to **Amazon ECR**.
- **Secure Deploy**: Connects to the private EC2 instance via the **Bastion Host** using SSH and restarts the container with the latest image.

### Required GitHub Secrets
To enable the pipeline, configure these secrets in your repository:
- `AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY`: Deployment credentials.
- `AWS_REGION`: e.g., `ap-south-2`.
- `ECR_REPOSITORY`: Name of your ECR repo.
- `BASTION_HOST`: Public IP of the bastion gateway.
- `BACKEND_PRIVATE_IP`: Private IP of the backend server.
- `DEPLOY_KEY`: Private SSH key for the servers.
- `MAIL_USERNAME` & `MAIL_PASSWORD`: For deployment notifications.

## 📜 Documentation
- [Deployment Setup Guide](deployment_setup.md): Detailed instructions for initial AWS configuration and GitHub orchestration.