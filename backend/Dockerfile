FROM ghcr.io/puppeteer/puppeteer:latest

# Set environment variables (excluding NODE_ENV during build)
ENV PORT=3001
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Use the default non-root user home directory
WORKDIR /home/pptruser/app

# Copy package files and set ownership to pptruser
COPY --chown=pptruser:pptruser package*.json ./

# Install ALL dependencies (including devDependencies like typescript)
RUN npm ci

# Copy project source code and set ownership to pptruser
COPY --chown=pptruser:pptruser . .

# Build TypeScript to JavaScript (tsc is now available!)
RUN npm run build

# Switch to production mode and prune devDependencies to save space
ENV NODE_ENV=production
RUN npm prune --production

# Expose backend API port
EXPOSE 3001

# Command to run the Express backend server
CMD [ "node", "dist/server.js" ]
