const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function promptChangeset() {
  // Check if we are in a TTY (interactive terminal)
  if (!process.stdin.isTTY) {
    return;
  }

  // Check for existing changesets in the .changeset directory
  const changesetDir = path.join(process.cwd(), '.changeset');
  const files = fs.readdirSync(changesetDir);
  
  // Filter for markdown files that aren't README.md
  const changesets = files.filter(f => f.endsWith('.md') && f !== 'README.md');

  if (changesets.length > 0) {
    console.log(`✅  ${changesets.length} changeset(s) detected.`);
    return;
  }

  console.log('\n⚠️  No changeset detected for this commit.');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise(resolve => {
    rl.question('Would you like to add a version bump (patch/minor/major) now? (y/n) ', resolve);
  });

  rl.close();

  if (answer.toLowerCase() === 'y') {
    console.log('🚀 Launching changeset prompt...\n');
    
    // Use spawnSync with inherit to allow interactivity
    const result = spawnSync('pnpm', ['changeset'], { 
      stdio: 'inherit',
      shell: true 
    });

    if (result.status !== 0) {
      console.error('❌  Changeset creation failed.');
      process.exit(1);
    }
    
    console.log('\n✅  Changeset created! Remember to `git add` the new changeset file.');
  } else {
    console.log('⏩  Skipping changeset. Remember to add one before merging to main.');
  }
}

promptChangeset().catch(err => {
  console.error('Error in prompt-changeset script:', err);
  process.exit(1);
});
