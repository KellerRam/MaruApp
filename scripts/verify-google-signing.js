// Compara el SHA-1 con el que se firmó el APK contra el certificate_hash de google-services.json.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const PACKAGE = 'com.maruapp';
const apk = path.join(root, 'android/app/build/outputs/apk/debug/app-debug.apk');
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');

function findApksigner() {
  const dir = path.join(sdk, 'build-tools');
  if (!fs.existsSync(dir)) throw new Error(`No existe ${dir}`);
  const versions = fs.readdirSync(dir).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  for (const v of versions) {
    const p = path.join(dir, v, process.platform === 'win32' ? 'apksigner.bat' : 'apksigner');
    if (fs.existsSync(p)) return p;
  }
  throw new Error('apksigner no encontrado en build-tools');
}

function apkSha1() {
  const out = execFileSync(findApksigner(), ['verify', '--print-certs', apk], { encoding: 'utf8', shell: process.platform === 'win32' });
  const m = out.match(/SHA-1 digest:\s*([0-9a-fA-F]+)/);
  if (!m) throw new Error(`No se pudo leer el SHA-1:\n${out}`);
  return m[1].toLowerCase();
}

const norm = (s) => s.replace(/:/g, '').toLowerCase();

const apkHash = apkSha1();
const gs = JSON.parse(fs.readFileSync(path.join(root, 'google-services.json'), 'utf8'));
const hashes = [];
for (const c of gs.client || []) {
  if (c.client_info?.android_client_info?.package_name !== PACKAGE) continue;
  for (const o of c.oauth_client || []) {
    if (o.android_info?.package_name === PACKAGE && o.android_info.certificate_hash) {
      hashes.push(norm(o.android_info.certificate_hash));
    }
  }
}

console.log(`SHA-1 del APK:            ${apkHash}`);
console.log(`certificate_hash en JSON: ${hashes.join(', ') || '(ninguno)'}`);

if (hashes.includes(apkHash)) {
  console.log('COINCIDEN: la firma del APK está registrada para com.maruapp.');
} else {
  console.log('DISCREPANCIA: el SHA-1 del APK no está en google-services.json. Causa del DEVELOPER_ERROR.');
  console.log(`Registra en Firebase el SHA-1: ${apkHash.match(/../g).join(':').toUpperCase()}`);
  process.exitCode = 1;
}
