import { execSync } from 'child_process';

function check(cmd: string, name: string) {
  try {
    const version = execSync(`${cmd} --version`, { encoding: 'utf-8' }).trim().split('\n')[0];
    console.log(`  ${name}: ${version}`);
    return true;
  } catch {
    console.error(`  ${name}: NOT FOUND`);
    return false;
  }
}

console.log('Checking system dependencies...');
const ytdlp = check('yt-dlp', 'yt-dlp');
const ffmpeg = check('ffmpeg', 'ffmpeg');

if (!ytdlp || !ffmpeg) {
  console.error('\nMissing dependencies. Install with:');
  if (!ytdlp) console.error('  brew install yt-dlp');
  if (!ffmpeg) console.error('  brew install ffmpeg');
  process.exit(1);
}

console.log('\nAll dependencies OK.');
