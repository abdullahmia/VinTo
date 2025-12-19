#!/bin/bash
set -e

echo "Publishing to VS Code Marketplace..."
npx vsce publish

echo "Publishing to Open VSX..."
# Temporarily update publisher for Open VSX
sed -i.bak 's/"publisher": "abdullahmia"/"publisher": "vinto"/' package.json

# Publish to Open VSX
npx ovsx publish

# Restore original publisher
mv package.json.bak package.json

echo "✅ Successfully published to both marketplaces!"
