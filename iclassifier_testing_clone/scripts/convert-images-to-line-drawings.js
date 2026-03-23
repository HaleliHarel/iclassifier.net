import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imagesDir = path.join(__dirname, '../public/images');

async function convertImagesToLineDrawings() {
  try {
    const files = fs.readdirSync(imagesDir);
    const imageFiles = files.filter(file => /\.(jpg|jpeg|png)$/i.test(file));

    console.log(`Found ${imageFiles.length} images to convert...`);

    for (const file of imageFiles) {
      const inputPath = path.join(imagesDir, file);
      try {
        await sharp(inputPath)
          .grayscale()
          .negate()
          .normalize()
          .median(2)
          .toFile(inputPath);
        
        console.log(`✓ Converted: ${file}`);
      } catch (err) {
        console.error(`✗ Failed to convert ${file}:`, err.message);
      }
    }

    console.log('\nAll images converted to line drawing style!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

convertImagesToLineDrawings();
