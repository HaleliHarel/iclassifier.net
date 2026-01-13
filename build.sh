#!/bin/bash
set -e

echo "Building iClassifier React app..."
cd iclassifier_testing_clone
npm run build:client

echo "Setting up static homepage..."
# Backup the React app index.html
cp dist/spa/index.html dist/spa/app.html

# Copy static homepage as the main index.html  
cp ../index.html dist/spa/index.html
cp ../style.css dist/spa/
cp -r ../images dist/spa/
cp -r ../about dist/spa/
cp -r ../contact dist/spa/
cp -r ../publications dist/spa/
cp -r ../iclassifier dist/spa/

echo "Build complete!"
echo "- Static homepage: dist/spa/index.html"
echo "- React app: dist/spa/app.html"