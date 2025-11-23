import { exec, execSync } from 'node:child_process'
import { consola } from 'consola'
import { DockerImage } from './DockerImage'

export class DockerUtils {
  static getImages(): DockerImage[] {
    try {
      const output = execSync('docker images --format \'{{.Repository}}:{{.Tag}}\'', { encoding: 'utf-8' })
      return output
        .split('\n')
        .filter(line => line.trim() !== '')
        .map((line) => {
          const cleanedLine = line.replace(/^'|'$/g, '') // 移除掉前后的单引号
          const [name, tag] = cleanedLine.split(':')
          return new DockerImage(name, tag)
        })
    }
    catch (error) {
      console.error('Error listing Docker images:', error)
      return []
    }
  }

  /**
   * 将docker image 打包成 tar 文件
   * @return 打包后的文件路径
   */
  static async saveImage(image: DockerImage): Promise<string> {
    try {
      const tarFilePath = `${image.getLegalFileName()}.tar`
      consola.info(`Save Docker image ${image.toString()} to ${tarFilePath}`)
      await new Promise((resolve, reject) => {
        exec(`docker save -o ${tarFilePath} ${image.toString()}`, (error) => {
          if (error) {
            reject(error)
          }
          else {
            resolve(null)
          }
        })
      })
      return tarFilePath
    }
    catch (error) {
      consola.error('Error packing Docker image:', error)
      throw new Error('Failed to pack Docker image')
    }
  }
}
