source gitingest-env/bin/activate #!/bin/bash

# Create api directory if it doesn't exist
mkdir -p api

# Copy the index.py to api directory
cp api/index.py api/

# Install dependencies
pip install -r requirements.txt

# Create __init__.py files if they don't exist
touch api/__init__.py
touch src/__init__.py
touch src/api/__init__.py
touch src/utils/__init__.py
touch src/models/__init__.py
touch src/services/__init__.py 