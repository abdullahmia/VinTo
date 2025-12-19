const fs = require('fs');
const { execSync } = require('child_process');

async function publish() {
  try {
    console.log('📦 Publishing to VS Code Marketplace...');
    execSync('npx vsce publish', { stdio: 'inherit' });
    
    console.log('\n📦 Publishing to Open VSX...');
    
    // Read package.json
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const originalPublisher = packageJson.publisher;
    
    // Temporarily change publisher to 'vinto'
    packageJson.publisher = 'vinto';
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
    
    try {
      // Publish to Open VSX
      execSync('npx ovsx publish', { stdio: 'inherit' });
    } finally {
      // Restore original publisher
      packageJson.publisher = originalPublisher;
      fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
    }
    
    console.log('\n✅ Successfully published to both marketplaces!');
  } catch (error) {
    console.error('❌ Publishing failed:', error.message);
    process.exit(1);
  }
}

publish();
