import plugin from "../../../lib/plugins/plugin.js";
import { createRequire } from "module";
import lodash from "lodash";
import { Restart } from "../../other/restart.js";

const require = createRequire(import.meta.url);
const { exec, execSync } = require("child_process");

// 是否在更新中
let uping = false;

/**
 * 处理插件更新
 */
export class update extends plugin {
  constructor() {
    super({
      name: "更新插件",
      dsc: "更新插件代码",
      event: "message",
      priority: 4000,
      rule: [
        {
          reg: "^#闲心(插件)?(强制)?更新",
          fnc: "update",
        },
      ],
    });
  }

  /**
   * rule - 更新闲心插件
   * @returns
   */
  async update() {
    if (!this.e.isMaster) return false;

    /** 检查是否正在更新中 */
    if (uping) {
      await this.reply("已有命令更新中..请勿重复操作");
      return;
    }

    /** 检查git安装 */
    if (!(await this.checkGit())) return;

    const isForce = this.e.msg.includes("强制");

    /** 执行更新 */
    await this.runUpdate(isForce);

    /** 是否需要重启 */
    if (this.isUp) {
      setTimeout(() => this.restart(), 2000);
    }
  }

  /**
   * 云崽重启操作
   */
  restart() {
    new Restart(this.e).restart();
  }

  /**
   * 闲心插件更新函数
   * @param {boolean} isForce 是否为强制更新
   * @returns
   */
  async runUpdate(isForce) {
    let command = "git -C ./plugins/xianxin-plugin/ pull --no-rebase";
    if (isForce) {
      command = `git -C ./plugins/xianxin-plugin/ checkout . && ${command}`;
      this.e.reply("正在执行强制更新操作，请稍等");
    } else {
      this.e.reply("正在执行更新操作，请稍等");
    }
    /** 获取上次提交的commitId，用于获取日志时判断新增的更新日志 */
    this.oldCommitId = await this.getcommitId("xianxin-plugin");
    uping = true;
    let ret = await this.execSync(command);
    uping = false;

    if (ret.error) {
      logger.mark(`${this.e.logFnc} 更新失败：闲心插件`);
      this.gitErr(ret.error, ret.stdout);
      return false;
    }

    /** 获取插件提交的最新时间 */
    let time = await this.getTime("xianxin-plugin");

    if (/(Already up[ -]to[ -]date|已经是最新的)/.test(ret.stdout)) {
      await this.reply(`闲心插件已经是最新版本\n最后更新时间：${time}`);
    } else {
      await this.reply(`闲心插件\n最后更新时间：${time}`);
      this.isUp = true;
      /** 获取闲心组件的更新日志 */
      let log = await this.getLog("xianxin-plugin");
      await this.reply(log);
    }

    logger.mark(`${this.e.logFnc} 最后更新时间：${time}`);

    return true;
  }

  /**
   * 获取闲心插件的更新日志
   * @param {string} plugin 插件名称
   * @returns
   */
  async getLog(plugin = "") {
    let cm = `cd ./plugins/${plugin}/ && git log  -20 --oneline --pretty=format:"%h||[%cd]  %s" --date=format:"%m-%d %H:%M"`;

    let logAll;
    try {
      logAll = await execSync(cm, { encoding: "utf-8" });
    } catch (error) {
      logger.error(error.toString());
      this.reply(error.toString());
    }

    if (!logAll) return false;

    logAll = logAll.split("\n");

    let log = [];
    for (let str of logAll) {
      str = str.split("||");
      if (str[0] == this.oldCommitId) break;
      if (str[1].includes("Merge branch")) continue;
      log.push(str[1]);
    }
    let line = log.length;
    log = log.join("\n\n");

    if (log.length <= 0) return "";

    let end = "";
    end =
      "更多详细信息，请前往gitee查看\nhttps://gitee.com/xianxincoder/xianxin-plugin/commits/master";

    log = await this.makeForwardMsg(`闲心插件更新日志，共${line}条`, log, end);

    return log;
  }

  /**
   * 获取上次提交的commitId
   * @param {string} plugin 插件名称
   * @returns
   */
  async getcommitId(plugin = "") {
    let cm = `git -C ./plugins/${plugin}/ rev-parse --short HEAD`;

    let commitId = await execSync(cm, { encoding: "utf-8" });
    commitId = lodash.trim(commitId);

    return commitId;
  }

  /**
   * 获取本次更新插件的最后一次提交时间
   * @param {string} plugin 插件名称
   * @returns
   */
  async getTime(plugin = "") {
    let cm = `cd ./plugins/${plugin}/ && git log -1 --oneline --pretty=format:"%cd" --date=format:"%m-%d %H:%M"`;

    let time = "";
    try {
      time = await execSync(cm, { encoding: "utf-8" });
      time = lodash.trim(time);
    } catch (error) {
      logger.error(error.toString());
      time = "获取时间失败";
    }
    return time;
  }

  /**
   * 制作转发消息
   * @param {string} title 标题 - 首条消息
   * @param {string} msg 日志信息
   * @param {string} end 最后一条信息
   * @returns
   */
  async makeForwardMsg(title, msg, end) {
    let nickname = Bot.nickname;
    if (this.e.isGroup) {
      let info = await Bot.getGroupMemberInfo(this.e.group_id, Bot.uin);
      nickname = info.card || info.nickname;
    }
    let userInfo = {
      user_id: Bot.uin,
      nickname,
    };

    let forwardMsg = [
      {
        ...userInfo,
        message: title,
      },
      {
        ...userInfo,
        message: msg,
      },
    ];

    if (end) {
      forwardMsg.push({
        ...userInfo,
        message: end,
      });
    }

    /** 制作转发内容 */
    if (this.e.isGroup) {
      forwardMsg = await this.e.group.makeForwardMsg(forwardMsg);
    } else {
      forwardMsg = await this.e.friend.makeForwardMsg(forwardMsg);
    }

    /** 处理描述 */
    forwardMsg.data = forwardMsg.data
      .replace(/\n/g, "")
      .replace(/<title color="#777777" size="26">(.+?)<\/title>/g, "___")
      .replace(/___+/, `<title color="#777777" size="26">${title}</title>`);

    return forwardMsg;
  }

  /**
   * 处理更新失败的相关函数
   * @param {string} err
   * @param {string} stdout
   * @returns
   */
  async gitErr(err, stdout) {
    let msg = "更新失败！";
    let errMsg = err.toString();
    stdout = stdout.toString();

    if (errMsg.includes("Timed out")) {
      let remote = errMsg.match(/'(.+?)'/g)[0].replace(/'/g, "");
      await this.reply(msg + `\n连接超时：${remote}`);
      return;
    }

    if (/Failed to connect|unable to access/g.test(errMsg)) {
      let remote = errMsg.match(/'(.+?)'/g)[0].replace(/'/g, "");
      await this.reply(msg + `\n连接失败：${remote}`);
      return;
    }

    if (errMsg.includes("be overwritten by merge")) {
      await this.reply(
        msg +
          `存在冲突：\n${errMsg}\n` +
          "请解决冲突后再更新，或者执行#强制更新，放弃本地修改"
      );
      return;
    }

    if (stdout.includes("CONFLICT")) {
      await this.reply([
        msg + "存在冲突\n",
        errMsg,
        stdout,
        "\n请解决冲突后再更新，或者执行#强制更新，放弃本地修改",
      ]);
      return;
    }

    await this.reply([errMsg, stdout]);
  }

  /**
   * 异步执行git相关命令
   * @param {string} cmd git命令
   * @returns
   */
  async execSync(cmd) {
    return new Promise((resolve, reject) => {
      exec(cmd, { windowsHide: true }, (error, stdout, stderr) => {
        resolve({ error, stdout, stderr });
      });
    });
  }

  /**
   * 检查git是否安装
   * @returns
   */
  async checkGit() {
    let ret = await execSync("git --version", { encoding: "utf-8" });
    if (!ret || !ret.includes("git version")) {
      await this.reply("请先安装git");
      return false;
    }
    return true;
  }
}
