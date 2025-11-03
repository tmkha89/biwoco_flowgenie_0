FROM node:20-alpine

WORKDIR /usr/src/app

RUN apk add --no-cache openssl

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (needed for Prisma generation)
RUN npm ci

# Prisma migrate
npm run prisma:migrate dev --name add_positions
# Generate Prisma Client
RUN npx prisma generate

# Remove dev dependencies after Prisma generation
RUN npm prune --production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "run", "start:prod"]
