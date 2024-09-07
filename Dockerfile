FROM node:20-alpine

WORKDIR /app

COPY package.json .

RUN yarn install

RUN npm i -g serve

COPY . .

CMD [ "yarn", "start" ]
