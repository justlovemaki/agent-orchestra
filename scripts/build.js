#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJsFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      readJsFiles(fullPath, files);
    } else if (item.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

function minifyJs(code) {
  let result = code;
  
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  result = result.replace(/\/\/.*$/gm, '');
  
  result = result.replace(/\s+/g, ' ');
  result = result.replace(/\s*([{};,=+\-*/<>!&|:?])\s*/g, '$1');
  result = result.replace(/;\s*}/g, '}');
  
  return result.trim();
}

function minifyCss(code) {
  let result = code;
  
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  
  result = result.replace(/\s+/g, ' ');
  result = result.replace(/\s*([{}:;,])\s*/g, '$1');
  result = result.replace(/;\s*}/g, '}');
  
  return result.trim();
}

function compressFile(srcPath, destDir, minifyFn) {
  const relativePath = path.relative(PUBLIC_DIR, srcPath);
  const destPath = path.join(destDir, relativePath);
  
  ensureDir(path.dirname(destPath));
  
  const content = fs.readFileSync(srcPath, 'utf-8');
  const minified = minifyFn(content);
  
  fs.writeFileSync(destPath, minified);
  console.log(`  ${relativePath} -> ${path.basename(destPath)}`);
}

function build() {
  console.log('Starting frontend build...\n');
  
  ensureDir(DIST_DIR);
  
  const jsFiles = readJsFiles(path.join(PUBLIC_DIR, 'js'));
  console.log('Compressing JS files:');
  for (const file of jsFiles) {
    compressFile(file, DIST_DIR, minifyJs);
  }
  
  console.log('\nCompressing CSS files (if any):');
  const cssDir = path.join(PUBLIC_DIR, 'css');
  if (fs.existsSync(cssDir)) {
    const cssFiles = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));
    for (const file of cssFiles) {
      const srcPath = path.join(cssDir, file);
      const destPath = path.join(DIST_DIR, 'css', file);
      ensureDir(path.dirname(destPath));
      const content = fs.readFileSync(srcPath, 'utf-8');
      fs.writeFileSync(destPath, minifyCss(content));
      console.log(`  ${file}`);
    }
  }
  
  console.log('\nCopying assets:');
  const assetsDir = path.join(PUBLIC_DIR, 'assets');
  if (fs.existsSync(assetsDir)) {
    copyDir(assetsDir, path.join(DIST_DIR, 'assets'));
    console.log('  assets/');
  }
  
  console.log('\n✓ Build completed successfully!');
  console.log(`  Output: ${DIST_DIR}`);
}

function copyDir(srcDir, destDir) {
  ensureDir(destDir);
  const items = fs.readdirSync(srcDir);
  for (const item of items) {
    const srcPath = path.join(srcDir, item);
    const destPath = path.join(destDir, item);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const command = process.argv[2] || 'build';
if (command === 'build') {
  build();
} else if (command === 'clean') {
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
    console.log('Cleaned dist directory');
  }
} else {
  console.log('Usage: node build.js [build|clean]');
}