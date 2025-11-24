#!/usr/bin/env node

// src/index.ts
import fs3 from "fs";
import os from "os";
import path2 from "path";
import { checkbox, password, search } from "@inquirer/prompts";
import { consola as consola2 } from "consola";

// src/DockerUtils.ts
import { exec, execSync } from "child_process";
import { consola } from "consola";

// src/DockerImage.ts
var DockerImage = class {
  name;
  tag;
  constructor(name, tag) {
    this.name = name;
    this.tag = tag;
  }
  toString() {
    return `${this.name}:${this.tag}`;
  }
  getLegalFileName() {
    return this.toString().replace(/[/:.-]/g, "_");
  }
};

// src/DockerUtils.ts
var DockerUtils = class {
  static getImages() {
    try {
      const output = execSync("docker images --format '{{.Repository}}:{{.Tag}}'", { encoding: "utf-8" });
      return output.split("\n").filter((line) => line.trim() !== "").map((line) => {
        const cleanedLine = line.replace(/^'|'$/g, "");
        const [name, tag] = cleanedLine.split(":");
        return new DockerImage(name, tag);
      });
    } catch (error) {
      console.error("Error listing Docker images:", error);
      return [];
    }
  }
  /**
   * 将docker image 打包成 tar 文件
   * @return 打包后的文件路径
   */
  static async saveImage(image) {
    try {
      const tarFilePath = `${image.getLegalFileName()}.tar`;
      await new Promise((resolve, reject) => {
        exec(`docker save -o ${tarFilePath} ${image.toString()}`, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve(null);
          }
        });
      });
      return tarFilePath;
    } catch (error) {
      consola.error("Error packing Docker image:", error);
      throw new Error("Failed to pack Docker image");
    }
  }
};

// src/Spinner.ts
import chalk from "chalk";
import ora from "ora";
var Spinner = class {
  spinner = ora({ spinner: "dots" });
  tag;
  tagChalk;
  constructor(tag) {
    this.tag = tag;
    this.tagChalk = chalk.blue(`[${tag}]`);
  }
  start(message) {
    this.spinner.start(`${this.tagChalk} ${message}`);
  }
  succeed(message) {
    this.spinner.succeed(`${this.tagChalk} ${message}`);
  }
  fail(message) {
    this.spinner.fail(`${this.tagChalk} ${message}`);
  }
  info(message) {
    this.spinner.info(`${this.tagChalk} ${message}`);
  }
  async taskBlock(name, task) {
    this.start(`Task started: ${name}`);
    const res = await task();
    this.succeed(`Task finished: ${name}`);
    return res;
  }
};

// src/SSHClient.ts
import * as fs from "fs";
import { Client } from "ssh2";
var SSHClient = class {
  client;
  config;
  constructor(config) {
    this.config = config;
  }
  async connect() {
    return new Promise((resolve, reject) => {
      this.client = new Client();
      this.client.on("ready", () => {
        resolve();
      }).on("error", (err) => {
        reject(err);
      }).connect(this.config);
    });
  }
  async disconnect() {
    if (this.client) {
      this.client.end();
    }
  }
  uploadFile(localPath, remotePath, progressCallback) {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error("SSH client is not connected."));
      }
      this.client.sftp((err, sftp) => {
        if (err) {
          return reject(err);
        }
        const readStream = fs.createReadStream(localPath);
        const writeStream = sftp.createWriteStream(remotePath);
        const totalSize = fs.statSync(localPath).size;
        let uploadedSize = 0;
        readStream.on("data", (chunk) => {
          uploadedSize += chunk.length;
          if (progressCallback) {
            progressCallback(uploadedSize / totalSize * 100);
          }
        });
        writeStream.on("close", () => resolve());
        writeStream.on("error", reject);
        readStream.pipe(writeStream);
      });
    });
  }
  executeCommand(command) {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error("SSH client is not connected."));
      }
      this.client.exec(command, (err, stream) => {
        if (err) {
          return reject(err);
        }
        let output = "";
        stream.on("data", (data) => {
          output += data.toString();
        });
        stream.on("close", () => resolve(output));
        stream.stderr.on("data", (data) => reject(new Error(data.toString())));
      });
    });
  }
};

// src/SSHUtils.ts
import fs2 from "fs";
import path from "path";
import SSHConfig, { LineType } from "ssh-config";
var SSHUtils = class {
  /**
   * load ssh config from ~/.ssh/config
   */
  static loadSSHConfig() {
    const sshConfigPath = path.join(process.env.HOME || process.env.USERPROFILE || "~", ".ssh", "config");
    if (!fs2.existsSync(sshConfigPath)) {
      throw new Error(`SSH config file not found at ${sshConfigPath}`);
    }
    const sshConfigContent = fs2.readFileSync(sshConfigPath, "utf-8");
    return SSHConfig.parse(sshConfigContent);
  }
  /**
   * 列出 所有的 SSH 配置文件里 所有 Host 别名
   */
  static getConfigHosts() {
    const config = this.loadSSHConfig();
    const hosts = config.filter((entry) => {
      return entry.type == LineType.DIRECTIVE && entry.param == "Host";
    });
    return hosts.map((entry) => "value" in entry ? entry.value : "");
  }
};

// src/index.ts
process.on("uncaughtException", (error) => {
  if (error.name == "ExitPromptError") {
    consola2.warn("Process interrupted. Exiting...");
  }
  process.exit(0);
});
async function start() {
  const images = DockerUtils.getImages();
  if (images.length === 0) {
    console.log("No Docker images found.");
    return;
  }
  const selectedImages = await checkbox({
    message: "Select docker images:",
    choices: DockerUtils.getImages().map((it) => {
      return it.toString();
    })
  });
  const hosts = SSHUtils.getConfigHosts();
  const host = await search({
    message: "Select a remote server:",
    source: (input, { signal }) => {
      if (input) {
        return hosts.filter((it) => it.toLowerCase().includes(input.toLowerCase()));
      }
      return hosts;
    }
  });
  const passwordAnswer = await password({
    message: "Enter SSH password:",
    mask: "*"
  });
  const sshConfig = SSHUtils.loadSSHConfig();
  const config = sshConfig.compute(host);
  const hostName = config.HostName;
  const port = config.Port || "22";
  const username = config.User;
  const keyFile = config.IdentityFile || ".ssh/id_rsa";
  let tarFilePath = "";
  try {
    const key = fs3.readFileSync(path2.resolve(os.homedir(), keyFile));
    const sshClient = new SSHClient({
      host: hostName,
      port: Number.parseInt(port),
      username,
      password: passwordAnswer,
      passphrase: passwordAnswer,
      privateKey: key
    });
    for (const selectedImage of selectedImages) {
      const dockerImage = images.find((image) => image.toString() === selectedImage);
      if (!dockerImage) {
        console.log("Invalid selection.");
        return;
      }
      const imageFullName = dockerImage.toString();
      const remotePath = `/tmp/${dockerImage.getLegalFileName()}.tar`;
      const spinner = new Spinner(imageFullName);
      tarFilePath = await spinner.taskBlock("Save docker image to tar file", () => {
        return DockerUtils.saveImage(dockerImage);
      });
      spinner.info(`${dockerImage.toString()} -> ${tarFilePath} saved.`);
      const prettyBytes = (await import("pretty-bytes")).default;
      const fileSize = fs3.statSync(tarFilePath).size;
      spinner.info(`Tar file size: ${prettyBytes(fileSize)}`);
      await sshClient.connect();
      await spinner.taskBlock(`Upload docker image to remote server: ${tarFilePath} -> ${remotePath}`, () => {
        return sshClient.uploadFile(tarFilePath, remotePath, (progress) => {
          spinner.start(`Uploading Docker image: ${progress.toFixed(2)}%`);
        });
      });
      await spinner.taskBlock(`Load docker image on remote server`, () => {
        const remoteCommand = `docker load -i ${remotePath}`;
        return sshClient.executeCommand(remoteCommand);
      });
      spinner.succeed(`Image deployment completed.`);
    }
  } catch (error) {
    consola2.error("An error occurred:", error);
  } finally {
    if (tarFilePath && fs3.existsSync(tarFilePath)) {
      fs3.unlinkSync(tarFilePath);
    }
  }
  process.exit(0);
}
start();
