FROM ghcr.io/puppeteer/puppeteer:latest

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Use the default non-root user home directory
WORKDIR /home/pptruser/app

# Copy package files and set ownership to pptruser
COPY --chown=pptruser:pptruser package*.json ./

# Install dependencies using npm
RUN npm ci

# Copy project source code and set ownership to pptruser
COPY --chown=pptruser:pptruser . .

# Build TypeScript to JavaScript
RUN npm run build

# Expose backend API port
EXPOSE 3001

# Command to run the Express backend server
CMD [ "node", "dist/server.js" ]
