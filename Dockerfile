FROM alpine:3.14

RUN apk add --no-cache python3 py3-pip
# The old pip cannot install markupsafe
RUN pip install --upgrade pip
RUN pip install flask flask_login WTForms gunicorn openpyxl pyjwt

RUN addgroup -S appgroup && adduser -S iclassifier -G appgroup
USER iclassifier
ENV HOME=/home/iclassifier

# Configuration via environment variables:
# - ICLASSIFIER_BASE_URL: Base URL for redirects (default: http://127.0.0.1:8000)
# - ICLASSIFIER_ALLOWED_ORIGIN: CORS origin header (default: http://127.0.0.1:8000)
# For production, set these to https://iclassifier.pw
# When ICLASSIFIER_BASE_URL is not set or is localhost, static files are served from the container.

#COPY data/auth $HOME/data/auth
COPY src/* $HOME/src/
COPY src/templates/* $HOME/src/templates/

# Copy frontend static files for local development
COPY --chown=iclassifier:appgroup frontend/js $HOME/src/static/js
COPY --chown=iclassifier:appgroup frontend/css $HOME/src/static/css
COPY --chown=iclassifier:appgroup frontend/img $HOME/src/static/img

#EXPOSE 8080

WORKDIR $HOME/src
CMD ["gunicorn", "-b", "0.0.0.0:8000", "app:app"]
