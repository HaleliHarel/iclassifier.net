#!/bin/bash

# iClassifier Database Setup Script
# This script helps you copy/link your database files to the correct location

echo "=== iClassifier Database Setup ==="
echo ""
echo "This script will help you set up your SQLite database files."
echo ""

# Check if databases directory exists
if [ ! -d "./databases" ]; then
    echo "Creating databases directory..."
    mkdir -p ./databases
fi

echo "Databases directory created at: ./databases"
echo ""

# List what should be there
echo "Expected files:"
echo "  ✓ ./databases/egyptian-texts.db     (Pebers - Egyptian text data)"
echo "  ✓ ./databases/anatolian-hieroglyphs.db  (Luwian - Anatolian text data)"
echo ""

# Check what's already there
echo "Current files in ./databases/:"
if [ -z "$(ls -A ./databases)" ]; then
    echo "  (empty - no files found)"
else
    ls -lh ./databases/
fi
echo ""

# Instructions
echo "Next steps:"
echo ""
echo "1. Copy your clf.db files to the databases directory:"
echo "   cp /path/to/pebers.db ./databases/egyptian-texts.db"
echo "   cp /path/to/luwian.db ./databases/anatolian-hieroglyphs.db"
echo ""
echo "2. Or create symlinks if you want to keep originals elsewhere:"
echo "   ln -s /path/to/pebers.db ./databases/egyptian-texts.db"
echo "   ln -s /path/to/luwian.db ./databases/anatolian-hieroglyphs.db"
echo ""
echo "3. Verify the files are readable:"
echo "   sqlite3 ./databases/egyptian-texts.db '.tables'"
echo "   sqlite3 ./databases/anatolian-hieroglyphs.db '.tables'"
echo ""
echo "4. Restart the dev server:"
echo "   npm run dev"
echo ""
echo "Done! The app will now load data from your databases."
