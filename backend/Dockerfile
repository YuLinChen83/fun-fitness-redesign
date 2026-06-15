FROM ghcr.io/puppeteer/puppeteer:latest

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Switch to root to copy and install packages
USER root

WORKDIR /usr/src/app

COPY package*.json ./

# Install project dependencies
RUN npm ci

# Copy application source code
COPY . .

# Build typescript code to dist/
RUN npm run build

# Expose backend API port
EXPOSE 3001

# Command to run the Express backend server
CMD [ "node", "dist/server.js" ]
