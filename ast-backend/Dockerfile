FROM node:24-alpine
WORKDIR /app

COPY package*.json ./
# نسخ مجلد بريزما أولاً لحل المشكلة
COPY prisma ./prisma/ 

RUN npm install
COPY . .

EXPOSE 5000
CMD ["npm", "start"]