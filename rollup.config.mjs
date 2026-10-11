import * as path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { promises as fsp } from 'fs';
import { deleteAsync as del } from 'del';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import { minify } from 'terser';
import OMT from '@surma/rollup-plugin-off-main-thread';
import replace from '@rollup/plugin-replace';
import { importMetaAssets } from '@web/rollup-plugin-import-meta-assets';

import simpleTS from './lib/simple-ts.js';
import clientBundlePlugin from './lib/client-bundle-plugin.js';
import nodeExternalPlugin from './lib/node-external-plugin.js';
import cssPlugin from './lib/css-plugin.js';
import urlPlugin from './lib/url-plugin.js';
import resolveDirsPlugin from './lib/resolve-dirs-plugin.js';
import runScript from './lib/run-script.js';
import emitFiles from './lib/emit-files-plugin.js';
import featurePlugin from './lib/feature-plugin.js';
import initialCssPlugin from './lib/initial-css-plugin.js';
import serviceWorkerPlugin from './lib/sw-plugin.js';
import dataURLPlugin from './lib/data-url-plugin.js';
import entryDataPlugin, { fileNameToURL } from './lib/entry-data-plugin.js';
import dedent from 'dedent';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveFileUrl({ fileName }) {
  return JSON.stringify(fileNameToURL(fileName));
}

function resolveClientAssetUrl({ fileName }) {
  return `new URL(${JSON.stringify(fileNameToURL(fileName))}, location.origin).href`;
}

function threadedCodecAssetsPlugin() {
  const codecModulePattern =
    /\/codecs\/(?:avif\/enc\/avif_enc|jxl\/enc\/jxl_enc|wp2\/enc\/wp2_enc)_mt(?:_simd)?\.js$/;
  const moduleInitialization = 'Module = Module || {};';

  function shortHash(source) {
    return createHash('sha256').update(source).digest('hex').slice(0, 8);
  }

  return {
    name: 'threaded-codec-assets',
    async transform(code, id) {
      if (!codecModulePattern.test(id)) return null;
      if (!code.includes('Module["mainScriptUrlOrBlob"]')) return null;

      const initializationCount = code.split(moduleInitialization).length - 1;
      if (initializationCount !== 1) {
        throw new Error(`Unexpected Emscripten module format in ${id}`);
      }

      const moduleName = path.basename(id, '.js');
      const assetDirectory = path.dirname(id);
      const workerSource = await fsp.readFile(
        path.join(assetDirectory, `${moduleName}.worker.js`),
      );
      const wasmSource = await fsp.readFile(
        path.join(assetDirectory, `${moduleName}.wasm`),
      );
      const workerFileName = `${moduleName}.worker-${shortHash(workerSource)}.js`;
      const wasmFileName = `${moduleName}-${shortHash(wasmSource)}.wasm`;
      const rewrittenEsmSource = (await fsp.readFile(id, 'utf8'))
        .replaceAll(`${moduleName}.worker.js`, workerFileName)
        .replaceAll(`${moduleName}.wasm`, wasmFileName);
      const minifiedEsm = await minify(rewrittenEsmSource, { module: true });
      if (!minifiedEsm.code) {
        throw new Error(`Failed to minify ESM pthread module ${id}`);
      }
      const esmSource = minifiedEsm.code;
      const mainScriptFileName = `${moduleName}-${shortHash(esmSource)}.js`;
      const workerModuleSource = workerSource
        .toString('utf8')
        .replaceAll(`./${moduleName}.js`, `./${mainScriptFileName}`);
      const mainScriptReference = this.emitFile({
        type: 'asset',
        fileName: `static/c/${mainScriptFileName}`,
        source: esmSource,
      });
      const workerReference = this.emitFile({
        type: 'asset',
        fileName: `static/c/${workerFileName}`,
        source: workerModuleSource,
      });
      const wasmReference = this.emitFile({
        type: 'asset',
        fileName: `static/c/${wasmFileName}`,
        source: wasmSource,
      });

      return code.replace(
        moduleInitialization,
        `${moduleInitialization}\n  Module["mainScriptUrlOrBlob"] = import.meta.ROLLUP_FILE_URL_${mainScriptReference};\n  Module["pthreadAssets"] = [import.meta.ROLLUP_FILE_URL_${workerReference}, import.meta.ROLLUP_FILE_URL_${wasmReference}];`,
      );
    },
  };
}

function resolveImportMetaUrlInStaticBuild(property, { moduleId }) {
  if (property !== 'url') return;
  throw new Error(dedent`
    Attempted to use a \`new URL(..., import.meta.url)\` pattern in ${path.relative(
      process.cwd(),
      moduleId,
    )} for URL that needs to end up in static HTML.
    This is currently unsupported.
  `);
}

const dir = '.tmp/build';
const staticPath = 'static/c/[name]-[hash][extname]';
const jsPath = staticPath.replace('[extname]', '.js');

function jsFileName(chunkInfo) {
  if (!chunkInfo.facadeModuleId) return jsPath;
  const parsedPath = path.parse(chunkInfo.facadeModuleId);
  if (parsedPath.name !== 'index') return jsPath;
  // Come up with a better name than 'index'
  const name = parsedPath.dir.split(/\\|\//).slice(-1);
  return jsPath.replace('[name]', name);
}

export default async function ({ watch }) {
  const omtLoaderPromise = fsp.readFile(
    path.join(__dirname, 'lib', 'omt.ejs'),
    'utf-8',
  );

  await del('.tmp/build');

  const isProduction = !watch;

  const tsPluginInstance = simpleTS('.', {
    watch,
  });
  const commonPlugins = () => [
    tsPluginInstance,
    resolveDirsPlugin([
      'src/static-build',
      'src/client',
      'src/shared',
      'src/features',
      'src/features-worker',
      'src/features-worker-worker-bridge',
      'src/sw',
      'src/worker-shared',
      'codecs',
    ]),
    urlPlugin(),
    dataURLPlugin(),
    cssPlugin(),
  ];

  return {
    input: 'src/static-build/index.tsx',
    output: {
      dir,
      format: 'cjs',
      assetFileNames: staticPath,
      exports: 'named',
      preserveModules: true,
    },
    watch: {
      clearScreen: false,
      exclude: ['**/*.ts', '**/*.tsx'],
      buildDelay: 250,
    },
    plugins: [
      { resolveFileUrl, resolveImportMeta: resolveImportMetaUrlInStaticBuild },
      clientBundlePlugin(
        {
          external: ['worker_threads'],
          plugins: [
            { resolveFileUrl: resolveClientAssetUrl },
            importMetaAssets(),
            threadedCodecAssetsPlugin(),
            OMT({ loader: await omtLoaderPromise }),
            serviceWorkerPlugin({
              output: 'static/serviceworker.js',
            }),
            ...commonPlugins(),
            commonjs(),
            resolve(),
            replace({
              __PRERENDER__: false,
              __PRODUCTION__: isProduction,
              preventAssignment: true,
            }),
            entryDataPlugin(),
            isProduction ? terser({ module: true }) : {},
          ],
          preserveEntrySignatures: false,
        },
        {
          dir,
          format: 'amd',
          chunkFileNames: jsFileName,
          entryFileNames: jsFileName,
          interop: 'esModule',
        },
        resolveFileUrl,
      ),
      ...commonPlugins(),
      emitFiles({ include: '**/*', root: path.join(__dirname, 'src', 'copy') }),
      emitFiles({
        include: '{squash_oxipng.js,squash_oxipng_bg.wasm,workerHelpers.js}',
        prefix: 'oxipng-parallel/',
        root: path.join(__dirname, 'codecs', 'oxipng', 'pkg-parallel'),
      }),
      nodeExternalPlugin(),
      featurePlugin(),
      replace({
        __PRERENDER__: true,
        __PRODUCTION__: isProduction,
        preventAssignment: true,
      }),
      initialCssPlugin(),
      runScript(dir + '/static-build/index.js'),
    ],
  };
}
