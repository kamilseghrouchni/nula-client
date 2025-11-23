FROM node:20-slim

WORKDIR /app

# Install the package globally
RUN npm install -g enrichr-mcp-server

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Run the server
CMD ["npx", "enrichr-mcp-server"]
