import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const androidDir = fileURLToPath(new URL('../android', import.meta.url))
const isWindows = process.platform === 'win32'
const command = isWindows ? 'gradlew.bat' : './gradlew'
const rawArgs = process.argv.slice(2)
const extraArgs = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs
const args = ['assembleDebug', ...extraArgs]

// OS差異を吸収してGradle WrapperからDebug APKをビルドする。
const result = spawnSync(command, args, {
  cwd: androidDir,
  shell: isWindows,
  stdio: 'inherit',
})

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)
