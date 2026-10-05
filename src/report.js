const fs = require('fs');
const path = require('path');

const input = path.resolve('./benchmark-results/latest.json');
const output = path.resolve('./benchmark-results/benchmark-report.md');

if (!fs.existsSync(input)) {
  console.error('No benchmark-results/latest.json found. Run npm run benchmark first.');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(input, 'utf8'));
let md = `# GTFS Redis vs MongoDB Benchmark Results\n\n`;
md += `Generated: ${data.generated_at}\n\n`;
md += `| Query | MongoDB avg (ms) | Redis avg (ms) | MongoDB p95 (ms) | Redis p95 (ms) | Faster by average |\n`;
md += `|---|---:|---:|---:|---:|---|\n`;

for (const row of data.results) {
  const faster = row.redis.average_ms < row.mongodb.average_ms ? 'Redis' : row.mongodb.average_ms < row.redis.average_ms ? 'MongoDB' : 'Tie';
  md += `| ${row.query} | ${row.mongodb.average_ms} | ${row.redis.average_ms} | ${row.mongodb.p95_ms} | ${row.redis.p95_ms} | ${faster} |\n`;
}

md += `\n## Interpretation\n\n`;
md += `These results are workload- and environment-specific. The benchmark should be repeated after changing the dataset size, indexes, database versions, or network topology. They demonstrate application behavior for this project rather than a universal ranking of Redis and MongoDB.\n`;

fs.writeFileSync(output, md);
console.log(`✅ Report written to ${output}`);
