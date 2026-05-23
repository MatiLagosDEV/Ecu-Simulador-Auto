const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function run(cmd) {
  console.log('> ' + cmd);
  return execSync(cmd, { stdio: 'inherit', shell: true });
}

function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const versionEnv = process.env.RELEASE_TAG || process.env.RELEASE || process.env.VERSION;
  const tag = versionEnv || (`v${pkg.version}`);

  const distDir = path.join(__dirname, '..', 'dist-electron');

  if (!fs.existsSync(distDir)) {
    console.error('Dist folder not found:', distDir);
    process.exit(1);
  }

  // Gather artifact paths (exe, yml)
  const artifacts = [];
  const files = fs.readdirSync(distDir);
  files.forEach(f => {
    const lower = f.toLowerCase();
    if (lower.endsWith('.exe') || lower.endsWith('.zip') || lower.endsWith('.msi') || lower.endsWith('.yml') || lower.endsWith('.yaml')) {
      artifacts.push(path.join(distDir, f));
    }
  });

  if (artifacts.length === 0) {
    console.error('No build artifacts found in', distDir);
    process.exit(1);
  }

  try {
    // Check if release exists
    try {
      run(`gh release view ${tag}`);
      console.log('Release exists:', tag);
    } catch (e) {
      console.log('Release does not exist, creating:', tag);
      run(`gh release create ${tag} -t "${tag}" -n "Release ${tag}"`);
    }

    // Upload artifacts (clobber existing)
    const uploadCmd = `gh release upload ${tag} ${artifacts.map(a => `"${a}"`).join(' ')} --clobber`;
    run(uploadCmd);

    console.log('Upload complete.');
  } catch (err) {
    console.error('Error during upload:', err);
    process.exit(1);
  }
}

main();
