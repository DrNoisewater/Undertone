import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function nativeBuildPlan(platform, root, windowsDirectory = 'C:\\Windows') {
  // Construct Windows paths using Windows separators even when testing elsewhere.
  const p = platform === 'win32' ? path.win32 : path;
  const outputDirectory = p.join(root, 'build', 'native');
  if (platform === 'win32') {
    const framework = p.join(windowsDirectory, 'Microsoft.NET', 'Framework64', 'v4.0.30319');
    const compiler = p.join(framework, 'csc.exe');
    const source = p.join(root, 'native', 'UndertoneHelper.cs');
    const references = ['UIAutomationClient.dll', 'UIAutomationTypes.dll', 'WindowsBase.dll'].map(f => p.join(framework, 'WPF', f));
    return {compiler, source, outputDirectory, cwd: root, required: [compiler, source, ...references],
      args: ['/nologo', '/target:exe', '/platform:x64', '/out:' + p.join(outputDirectory, 'undertone-helper.exe'), '/r:System.Web.Extensions.dll', ...references.map(f => '/r:' + f), source]};
  }
  if (platform === 'darwin') {
    const source = p.join(root, 'swift', 'OpenWhispHelper.swift');
    return {compiler:'swiftc', source, outputDirectory, cwd:root, required:[source], args:[source, '-o', p.join(outputDirectory, 'openwhisp-helper')]};
  }
  return null;
}

export function buildNative(platform = process.platform, root = projectRoot, io = {}) {
  const fileExists = io.existsSync ?? existsSync;
  const makeDirectory = io.mkdirSync ?? mkdirSync;
  const runCompiler = io.spawnSync ?? spawnSync;
  const plan = nativeBuildPlan(platform, root, process.env.WINDIR || 'C:\\Windows');
  if (!plan) {
    console.log('Native helpers must be built on Windows or macOS. JS checks/builds are available here.');
    return 0;
  }
  const missing = plan.required.filter(file => !fileExists(file));
  if (missing.length) throw new Error('Native build prerequisites are missing:\n' + missing.map(file => '  ' + file).join('\n') + '\nExtract the complete source ZIP. On Windows, the .NET Framework 4.8 compiler and WPF assemblies are required.');
  makeDirectory(plan.outputDirectory, {recursive:true});
  console.log('Compiling native helper: ' + plan.source);
  // Pass each argument directly; Node handles spaces without a shell or manual quotes.
  const result = runCompiler(plan.compiler, plan.args, {cwd:plan.cwd, stdio:'inherit', shell:false});
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = buildNative(); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
