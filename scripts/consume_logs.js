const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '..', 'logs');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-n');

function summarizeContent(content) {
  const trimmed = content.slice(0, 2000);
  try {
    const j = JSON.parse(content);
    return { type: 'json', summary: JSON.stringify(j, null, 2).slice(0, 2000) };
  } catch (e) {
    return { type: 'text', summary: trimmed };
  }
}

(async () => {
  try {
    if (!fs.existsSync(logsDir)) {
      console.log('logs directory not found:', logsDir);
      process.exit(0);
    }

    const files = fs.readdirSync(logsDir).filter(f => !f.startsWith('.'));
    if (files.length === 0) {
      console.log('No log files found in', logsDir);
      return;
    }

    console.log(`Found ${files.length} log file(s). dryRun=${dryRun}`);

    for (const file of files) {
      const full = path.join(logsDir, file);
      try {
        const stat = fs.statSync(full);
        if (!stat.isFile()) continue;
        const content = fs.readFileSync(full, 'utf8');
        const summary = summarizeContent(content);
        console.log('---');
        console.log('File:', file, 'size:', stat.size, 'mtime:', stat.mtime.toISOString());
        console.log('Content type:', summary.type);
        console.log(summary.summary);

        if (!dryRun) {
          try {
            fs.unlinkSync(full);
            console.log('Deleted', file);
          } catch (e) {
            console.warn('Failed to delete', file, e.message);
          }
        } else {
          console.log('(dry-run) not deleting', file);
        }
      } catch (e) {
        console.warn('Error processing', file, e.message);
      }
    }
  } catch (e) {
    console.error('Unexpected error:', e);
    process.exit(2);
  }
})();
