import chalk from 'chalk'
import ora from 'ora'

export class Spinner {
  spinner = ora({ spinner: 'dots' })
  tag: string
  tagChalk: string
  constructor(tag: string) {
    this.tag = tag
    this.tagChalk = chalk.blue(`[${tag}]`)
  }

  start(message: string) {
    this.spinner.start(`${this.tagChalk} ${message}`)
  }

  succeed(message: string) {
    this.spinner.succeed(`${this.tagChalk} ${message}`)
  }

  fail(message: string) {
    this.spinner.fail(`${this.tagChalk} ${message}`)
  }

  info(message: string) {
    this.spinner.info(`${this.tagChalk} ${message}`)
  }

  async taskBlock<T>(name: string, task: () => Promise<T>) {
    this.start(`Task started: ${name}`)
    const res = await task()
    this.succeed(`Task finished: ${name}`)
    return res
  }
}
