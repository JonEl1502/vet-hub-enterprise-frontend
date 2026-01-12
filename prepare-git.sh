#!/bin/bash
set -e

# This script initializes a new git repository in the frontend directory,
# commits all existing files, and pushes them to the specified GitHub remote.

echo "# vet-hub-enterprise-frontend" >> README.md
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/JonEl1502/vet-hub-enterprise-frontend.git
git push -u origin main
