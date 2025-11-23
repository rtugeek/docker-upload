import fs from 'node:fs'
import path from 'node:path'
import SSHConfig, { LineType } from 'ssh-config'

export class SSHUtils {
  /**
   * load ssh config from ~/.ssh/config
   */
  static loadSSHConfig() {
    // read ssh config file
    const sshConfigPath = path.join(process.env.HOME || process.env.USERPROFILE || '~', '.ssh', 'config')
    if (!fs.existsSync(sshConfigPath)) {
      throw new Error(`SSH config file not found at ${sshConfigPath}`)
    }

    const sshConfigContent = fs.readFileSync(sshConfigPath, 'utf-8')
    return SSHConfig.parse(sshConfigContent)
  }

  /**
   * 列出 所有的 SSH 配置文件里 所有 Host 别名
   */
  static getConfigHosts(): string[] {
    const config = this.loadSSHConfig()
    const hosts = config
      .filter((entry) => {
        return entry.type == LineType.DIRECTIVE && entry.param == 'Host'
      })
    return hosts.map(entry => ('value' in entry) ? entry.value as string : '')
  }
}
