FROM node:22-alpine AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
<<<<<<< HEAD
RUN yarn build

FROM node:22-alpine
WORKDIR /app
# 정적 파일을 서빙할 'serve' 패키지 설치
RUN yarn global add serve
# 빌드된 결과물만 가져오기
COPY --from=build /app/dist /app/dist

# 5173 포트로 실행, -s 옵션이 SPA 라우팅(404 방지)을 해결함
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "tcp://0.0.0.0:5173"]
=======
ARG VITE_API_BASE_URL
ARG VITE_API_BASE_URL2
ARG VITE_CORE_API_URL
ARG VITE_AI_BASE_URL
ARG VITE_CANVAS_API_URL
ARG VITE_CANVAS_SOCKET_URL
ARG VITE_UPLOAD_API_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_API_BASE_URL2=$VITE_API_BASE_URL2
ENV VITE_CORE_API_URL=$VITE_CORE_API_URL
ENV VITE_AI_BASE_URL=$VITE_AI_BASE_URL
ENV VITE_CANVAS_API_URL=$VITE_CANVAS_API_URL
ENV VITE_CANVAS_SOCKET_URL=$VITE_CANVAS_SOCKET_URL
ENV VITE_UPLOAD_API_URL=$VITE_UPLOAD_API_URL
RUN yarn build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 5173
>>>>>>> 678fcbf (separate repository to flownote-service)
