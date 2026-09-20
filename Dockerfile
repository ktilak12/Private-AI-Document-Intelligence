# PAIDI Frontend Nginx Web Server
FROM nginx:alpine

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy all static assets and HTML views
COPY *.html /usr/share/nginx/html/
COPY api-client.js /usr/share/nginx/html/
COPY assets /usr/share/nginx/html/assets

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
