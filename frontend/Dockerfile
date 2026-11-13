# Etapa 1: build de la app (Create React App)
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Etapa 2: servidor web nginx
FROM nginx:alpine
# Fallback para las rutas de React Router (/usuarios, /login, ...): sin esto, recargar la página da 404.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
