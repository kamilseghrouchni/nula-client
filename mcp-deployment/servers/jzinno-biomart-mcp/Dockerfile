FROM node:20-slim

WORKDIR /app

# Install the package globally
RUN npm install -g @jzinno/biomart-mcp

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Run the server
CMD ["npx", "@jzinno/biomart-mcp"]
