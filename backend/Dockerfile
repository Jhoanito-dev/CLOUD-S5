FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN apk add --no-cache curl && \
	npm install

COPY . .

EXPOSE 3000

# Copy and make wait script executable
COPY ./wait-for-services.sh /wait-for-services.sh
RUN chmod +x /wait-for-services.sh

ENV POSTGRES_HOST=postgres
ENV POSTGRES_USER=clouduser
ENV POSTGRES_DB=roadworks

CMD ["/wait-for-services.sh"]
