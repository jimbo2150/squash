import { promises as fs, readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(
  repoRoot,
  'src/features/encoders/codec-versions.ts',
);

const codecModules = {
  avif: 'codecs/avif/node_modules/build/version/enc/avif_node_enc.js',
  webP: 'codecs/webp/enc/webp_node_enc.js',
  mozJPEG: 'codecs/mozjpeg/enc/mozjpeg_node_enc.js',
  jxl: 'codecs/jxl/enc/jxl_node_enc.js',
};

const safeRequire = (moduleName) => {
  if (moduleName === 'fs') {
    return { readFileSync };
  }
  if (moduleName === 'path') {
    return {
      dirname: path.dirname,
      normalize: path.normalize,
    };
  }
  throw new Error(`Unsupported module requested by codec: ${moduleName}`);
};

async function initializeCodecModule(relativePath) {
  const modulePath = path.join(repoRoot, relativePath);
  const source = await fs.readFile(modulePath, 'utf8');
  const exportPattern = /export\s+default\s+Module\s*;/;

  if (!exportPattern.test(source)) {
    throw new Error(`Unexpected Emscripten module format: ${relativePath}`);
  }

  const moduleSource = source
    .replace(/import\.meta\.url/g, JSON.stringify(pathToFileURL(modulePath).href))
    .replace(exportPattern, 'globalThis.__squooshModule = Module;');
  const context = vm.createContext({
    Module: {
      locateFile: (filename) => path.join(path.dirname(modulePath), filename),
    },
    __dirname: path.dirname(modulePath),
    require: safeRequire,
    process: { argv: [] },
    console,
    WebAssembly,
    TextDecoder,
    TextEncoder,
  });

  vm.runInContext(moduleSource, context, { filename: modulePath });
  return context.__squooshModule({
    noInitialRun: true,
    locateFile: (filename) => path.join(path.dirname(modulePath), filename),
  });
}

function formatPackedVersion(value, bytes) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) return undefined;
  const parts = [];
  for (let index = bytes - 1; index >= 0; index--) {
    parts.push((number >>> (index * 8)) & 255);
  }
  return parts.join('.');
}

function formatJxlVersion(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) return undefined;
  const major = Math.floor(number / 1_000_000);
  const minor = Math.floor(number / 1_000) % 1_000;
  const patch = number % 1_000;
  return `${major}.${minor}.${patch}`;
}

function isSemanticVersion(value) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value);
}

async function getExistingVersions() {
  try {
    const generatedFile = await fs.readFile(outputPath, 'utf8');
    const versions = {};
    const pattern = /^\s*([A-Za-z]\w*): '([^']+)',?\s*$/gm;
    for (const match of generatedFile.matchAll(pattern)) {
      if (isSemanticVersion(match[2])) versions[match[1]] = match[2];
    }
    return versions;
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function getCodecVersion(name, relativePath, formatVersion) {
  const modulePath = path.join(repoRoot, relativePath);
  try {
    await fs.access(modulePath);
  } catch (error) {
    if (error.code === 'ENOENT') return { available: false };
    throw error;
  }

  try {
    const module = await initializeCodecModule(relativePath);
    if (typeof module.version !== 'function') {
      return { available: true, version: undefined };
    }
    const version = formatVersion(module.version());
    return {
      available: true,
      version: version && isSemanticVersion(version) ? version : undefined,
    };
  } catch (error) {
    const wrappedError = new Error(`Unable to read ${name} version: ${error.message}`);
    wrappedError.cause = error;
    throw wrappedError;
  }
}

async function getOxiPngVersion() {
  const lockPath = path.join(repoRoot, 'codecs/oxipng/Cargo.lock');
  const lockfile = await fs.readFile(lockPath, 'utf8');
  const match = lockfile.match(
    /\[\[package\]\]\s*name = "oxipng"\s*version = "([^\"]+)"/,
  );
  return match && isSemanticVersion(match[1]) ? match[1] : undefined;
}

async function main() {
  const versions = await getExistingVersions();
  const versionReaders = {
    avif: (value) => value,
    webP: (value) => formatPackedVersion(value, 3),
    mozJPEG: (value) => formatPackedVersion(value, 3),
    jxl: formatJxlVersion,
  };
  for (const [name, relativePath] of Object.entries(codecModules)) {
    const result = await getCodecVersion(
      name,
      relativePath,
      versionReaders[name],
    );
    if (!result.available) continue;
    if (result.version) {
      versions[name] = result.version;
    } else {
      delete versions[name];
    }
  }

  const oxiPngVersion = await getOxiPngVersion();
  if (oxiPngVersion) versions.oxiPNG = oxiPngVersion;

  const versionEntries = Object.entries(versions)
    .map(([name, version]) => `  ${name}: '${version}',`)
    .join('\n');
  const generatedFile = [
    'const codecVersions: Record<string, string | undefined> = {',
    versionEntries,
    '};',
    '',
    'export default codecVersions;',
    '',
  ].join('\n');
  await fs.writeFile(outputPath, generatedFile);
}

await main();
