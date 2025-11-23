import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkbox, password, search } from '@inquirer/prompts'
import { consola } from 'consola'
import { DockerUtils } from './DockerUtils'
import { Spinner } from './Spinner'
import { SSHClient } from './SSHClient'
import { SSHUtils } from './SSHUtils'

process.on('uncaughtException', (error) => {
  if (error.name == 'ExitPromptError') {
    consola.warn('Process interrupted. Exiting...')
  }
  process.exit(0)
})

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function start() {
  // 1. 使用inquirer.js 让用户选择本地的 docker image
  const images = DockerUtils.getImages()
  if (images.length === 0) {
    console.log('No Docker images found.')
    return
  }

  const selectedImages = await checkbox<string>({
    message: 'Select docker images:',
    choices: DockerUtils.getImages().map((it) => {
      return it.toString()
    }),
  })

  // 2. 提示用户选择 远程服务器
  const hosts = SSHUtils.getConfigHosts()
  const host = await search<string>({
    message: 'Select a remote server:',
    source: (input, { signal }) => {
      if (input) {
        return hosts.filter(it => it.toLowerCase().includes(input.toLowerCase()))
      }
      return hosts
    },
  })
  const passwordAnswer = await password({
    message: 'Enter SSH password:',
    mask: '*',
  })
  const sshConfig = SSHUtils.loadSSHConfig()
  const config = sshConfig.compute(host)
  const hostName = config.HostName as string
  const port = config.Port as string || '22'
  const username = config.User as string
  const keyFile = config.IdentityFile as string || '.ssh/id_rsa'
  let tarFilePath = ''
  try {
    const key = fs.readFileSync(path.resolve(os.homedir(), keyFile))
    const sshClient = new SSHClient({
      host: hostName,
      port: Number.parseInt(port),
      username,
      password: passwordAnswer,
      passphrase: passwordAnswer,
      privateKey: key,
    })
    for (const selectedImage of selectedImages) {
      const dockerImage = images.find(image => image.toString() === selectedImage)
      if (!dockerImage) {
        console.log('Invalid selection.')
        return
      }
      const imageFullName = dockerImage.toString()
      const remotePath = `/tmp/${dockerImage.getLegalFileName()}.tar`
      const spinner = new Spinner(imageFullName)
      // 3. 打包 docker image 成 tar 文件
      tarFilePath = await spinner.taskBlock('Save docker image to tar file', () => {
        return DockerUtils.saveImage(dockerImage)
      })
      const prettyBytes = (await import('pretty-bytes')).default
      const fileSize = fs.statSync(tarFilePath).size
      spinner.info(`Tar file size: ${prettyBytes(fileSize)}`)
      // 4. 通过 sftp 上传到远程服务器
      await sshClient.connect()
      await spinner.taskBlock(`Upload docker image to remote server: ${tarFilePath} -> ${remotePath}`, () => {
        return sshClient.uploadFile(tarFilePath, remotePath, (progress) => {
          spinner.start(`Uploading Docker image: ${progress.toFixed(2)}%`)
        })
      })
      // 5. 通过ssh 在远程服务器上加载 docker image
      await spinner.taskBlock(`Load docker image on remote server`, () => {
        const remoteCommand = `docker load -i ${remotePath}`
        return sshClient.executeCommand(remoteCommand)
      })
      spinner.succeed(`Image deployment completed.`)
    }
  }
  catch (error) {
    consola.error('An error occurred:', error)
  }
  finally {
    if (tarFilePath && fs.existsSync(tarFilePath)) {
      fs.unlinkSync(tarFilePath)
    }
  }
  process.exit(0)
}

start()
