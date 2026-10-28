const fs = require('node:fs/promises');
const path = require('node:path');
const { NtExecutable, NtExecutableResource, Data, Resource } = require('resedit');

function brandExecutable(binary, iconBinary) {
  const executable = NtExecutable.from(binary, { ignoreCert: true });
  const resources = NtExecutableResource.from(executable);
  const icons = Data.IconFile.from(iconBinary).icons.map(item => item.data);
  if (!icons.length) throw new Error('Undertone icon has no images.');
  // Remove every Electron icon group so Explorer cannot select a leftover atom icon.
  resources.entries = resources.entries.filter(entry => entry.type !== 3 && entry.type !== 14);
  Resource.IconGroupEntry.replaceIconsForResource(resources.entries, 1, 1033, icons);
  resources.outputResource(executable);
  const output = Buffer.from(executable.generate());
  const verified = NtExecutableResource.from(NtExecutable.from(output));
  const groups = Resource.IconGroupEntry.fromEntries(verified.entries);
  if (groups.length !== 1 || groups[0].icons.length !== icons.length) throw new Error('Executable icon verification failed.');
  return output;
}

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const executablePath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const iconPath = path.join(context.packager.projectDir, 'build', 'icons', 'icon.ico');
  const [binary, icon] = await Promise.all([fs.readFile(executablePath), fs.readFile(iconPath)]);
  const output = brandExecutable(binary, icon);
  const temporaryPath = executablePath + '.branding.tmp';
  try {
    await fs.writeFile(temporaryPath, output);
    await fs.rename(temporaryPath, executablePath);
  } finally { await fs.rm(temporaryPath, { force: true }); }
  console.log('Applied Undertone executable icon (no external signing tools required).');
};
module.exports.brandExecutable = brandExecutable;
