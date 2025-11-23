export class DockerImage {
  name: string
  tag: string

  constructor(name: string, tag: string) {
    this.name = name
    this.tag = tag
  }

  toString(): string {
    return `${this.name}:${this.tag}`
  }

  getLegalFileName(): string {
    return this.toString().replace(/[/:.-]/g, '_')
  }
}
