const path = __dirname;
const git = require('./node_modules/isomorphic-git');
const http = require('./node_modules/isomorphic-git/http/node');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Please enter your GitHub Personal Access Token (PAT): ', async (token) => {
  rl.close();
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    console.error('Token cannot be empty.');
    process.exit(1);
  }

  console.log('\nPushing branch master to https://github.com/roaringrebel/Virtualengine.git ...');
  try {
    const pushResult = await git.push({
      fs,
      http,
      dir: path,
      remote: 'origin',
      ref: 'master',
      onAuth: () => ({ username: trimmedToken })
    });

    console.log('\nSUCCESS! Code has been pushed to GitHub.');
    console.log('Push acknowledgment:', JSON.stringify(pushResult, null, 2));
    console.log('\nView your updated code at: https://github.com/roaringrebel/Virtualengine');
  } catch (err) {
    console.error('\nPush failed:', err.message || err);
    if (err.data) {
      console.error('Details:', err.data);
    }
  }
});
