import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tr46Path = path.join(__dirname, '../node_modules/tr46/index.js');

try {
  const fileContent = await readFile(tr46Path, 'utf-8');
  const updatedContent = fileContent.replace(
    "const punycode = require('punycode');",
    "import punycode from 'punycode/';"
  );

  await writeFile(tr46Path, updatedContent, 'utf-8');
  console.log('Fixed tr46 to use punycode/');
} catch (error) {
  console.error('Failed to fix tr46:', error);
}
