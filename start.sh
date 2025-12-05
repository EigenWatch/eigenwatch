#!/bin/sh
set -e

# Generate Prisma Client based on the schema
echo "--> Generating Prisma Client..."
npx prisma generate

# Start the application on port 4000
export PORT=4000
echo "--> Starting Server on port $PORT..."
node dist/main