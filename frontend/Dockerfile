FROM node:22-alpine

WORKDIR /app

# Copy root and workspace manifests for dependency resolution
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies for the frontend workspace
RUN npm ci --workspace=@dealership/frontend --include-workspace-root

# Copy frontend source files and configuration
COPY frontend/ ./frontend/

WORKDIR /app/frontend

EXPOSE 5173

CMD ["npm", "run", "dev"]
