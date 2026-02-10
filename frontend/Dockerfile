FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN apk add --no-cache curl && \
	npm install

COPY . .

EXPOSE 5173

# Copy and make wait script executable
COPY ./wait-for-backend.sh /wait-for-backend.sh
RUN chmod +x /wait-for-backend.sh

ENV BACKEND_URL=http://backend:3000/health

CMD ["/wait-for-backend.sh"]
