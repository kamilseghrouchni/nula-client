FROM node:20-slim

WORKDIR /app

# Install the package globally
RUN npm install -g BioThings-MCP-Server@latest

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Run the server
CMD ["npx", "BioThings-MCP-Server@latest"]
