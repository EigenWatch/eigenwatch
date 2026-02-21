#!/bin/sh
set -e

# Generate Prisma Clients based on the schemas
echo "--> Generating Prisma Clients..."
npm run prisma:generate

# Start the application on port 5000
export PORT=5000
echo "--> Starting Server on port $PORT..."
node dist/src/main