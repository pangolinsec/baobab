FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install

# Copy source
COPY . .

# Create data directory
RUN mkdir -p /data

EXPOSE 3001

CMD ["npm", "run", "dev"]
