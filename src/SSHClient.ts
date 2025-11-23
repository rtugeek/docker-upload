import * as fs from 'node:fs'
import { Client, ConnectConfig } from 'ssh2'

export class SSHClient {
  client?: Client
  config: ConnectConfig

  constructor(config: ConnectConfig) {
    this.config = config
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client = new Client()
      this.client.on('ready', () => {
        resolve()
      }).on('error', (err) => {
        reject(err)
      }).connect(this.config)
    })
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.end()
    }
  }

  uploadFile(localPath: string, remotePath: string, progressCallback?: (progress: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('SSH client is not connected.'))
      }
      this.client.sftp((err, sftp) => {
        if (err) {
          return reject(err)
        }
        const readStream = fs.createReadStream(localPath)
        const writeStream = sftp.createWriteStream(remotePath)

        const totalSize = fs.statSync(localPath).size
        let uploadedSize = 0

        readStream.on('data', (chunk) => {
          uploadedSize += chunk.length
          if (progressCallback) {
            progressCallback((uploadedSize / totalSize) * 100)
          }
        })

        writeStream.on('close', () => resolve())
        writeStream.on('error', reject)
        readStream.pipe(writeStream)
      })
    })
  }

  executeCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('SSH client is not connected.'))
      }
      this.client.exec(command, (err, stream) => {
        if (err) {
          return reject(err)
        }
        let output = ''
        stream.on('data', (data: Buffer) => {
          output += data.toString()
        })
        stream.on('close', () => resolve(output))
        stream.stderr.on('data', (data: Buffer) => reject(new Error(data.toString())))
      })
    })
  }
}
