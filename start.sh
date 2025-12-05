#!/bin/sh
set -e

# 1. Pull the latest database schema
# Requires DATABASE_URL to be set in the environment
echo "--> Pulling DB schema..."
npx prisma db pull

# 2. Generate Prisma Client based on the new schema
echo "--> Generating Prisma Client..."
npx prisma generate

# 3. Start the application on port 4000
export PORT=4000
echo "--> Starting Server on port $PORT..."
node dist/main