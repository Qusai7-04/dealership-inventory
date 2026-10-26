FROM node:22-alpine

WORKDIR /app

# Copy root and workspace manifests for dependency resolution
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies for the backend workspace
RUN npm ci --workspace=@dealership/backend --include-workspace-root

# Copy backend source, migrations, data and static assets
COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src
COPY backend/migrations ./backend/migrations
COPY backend/public ./backend/public
COPY backend/data ./backend/data

WORKDIR /app/backend

# Build TypeScript to verify compilation and prepare dist/
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npm run migrate && npm run dev"]
