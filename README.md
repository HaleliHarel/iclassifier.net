This repository contains the code for the backend and frontend of the input system of the iClassifier project.
The system consists of several parts:

1. The backend code, which is stored in this repository. It includes templates for all project pages.
2. Database files containing project data and user information. These are not distributed openly. Database schemas for them will be included in the project documentation.
3. The frontend JavaScript code, CSS files, and images.
4. Auxiliary services: a web-wrapper for the JSesh visualisation library, a dictionary server, and a bibliographical server. They are distributed separately at XXX, XXX, and XXX respectively.

## Configuration

The application is configured via environment variables:

- `ICLASSIFIER_BASE_URL`: Base URL for the application (used for redirects and URL generation). Default: `http://127.0.0.1:8000`
- `ICLASSIFIER_ALLOWED_ORIGIN`: Allowed origin for CORS headers. Default: `http://127.0.0.1:8000`

### Running locally for development

```bash
docker run -it -p 127.0.0.1:8000:8000 \
  --mount type=bind,src="$(pwd)/data",target="/home/iclassifier/data" \
  macleginn/iclassifier:backend

docker run -it -p 127.0.0.1:8000:8000 \
  --user $(id -u):$(id -g) \
  --mount type=bind,src="$(pwd)/data",target="/home/iclassifier/data" \
  macleginn/iclassifier:backend
```

### Running in production

```bash
docker run -d -p 8000:8000 \
  -e ICLASSIFIER_BASE_URL=https://iclassifier.pw \
  -e ICLASSIFIER_ALLOWED_ORIGIN=https://iclassifier.pw \
  --mount type=bind,src="/path/to/data",target="/home/iclassifier/data" \
  macleginn/iclassifier:backend
```