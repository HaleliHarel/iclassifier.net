# Production Database Setup

For production deployment on Netlify, you have a few options for handling the database files:

## Option 1: Environment Variables with External Database
Set up a remote database service like PlanetScale, Supabase, or Railway and connect via environment variables.

## Option 2: Bundle Small Databases
For smaller database files, you can include them in the deployment:

1. Create a `public/data` folder
2. Add your database files there
3. Update the `ICLASSIFIER_DATA_PATH` to point to the public folder

## Option 3: Use Object Storage
Upload databases to AWS S3, Google Cloud Storage, or similar and fetch them at runtime.

## Current Setup
Your environment is configured to look for databases in `./data/projects/`

For now, you can test with a sample database by creating:
```
public/data/projects/sample.db
```