import plugin from "../../../lib/plugins/plugin.js";
import { exec } from "child_process";

const _path = process.cwd();

export class admin extends plugin {
  constructor() {
    super({
      name: "管理|更新插件",
      dsc: "管理和更新代码",
      event: "message",
      priority: 400,
      rule: [
        {
          reg: "^#闲心插件(强制)?更新",
          fnc: "checkout",
        },
      ],
    });
  }

  async checkout() {
    if (!this.e.isMaster) {
      return;
    }
    const isForce = this.e.msg.includes("强制");
    let command = "git  pull";
    if (isForce) {
      command = "git  checkout . && git  pull";
      this.reply("正在执行强制更新操作，请稍等");
    } else {
      this.reply("正在执行更新操作，请稍等");
    }
    console.log(`${_path}/plugins/xianxin-plugin/`);
    const that = this;
    exec(
      command,
      { cwd: `${_path}/plugins/xianxin-plugin/` },
      function (error, stdout, stderr) {
        if (/(Already up[ -]to[ -]date|已经是最新的)/.test(stdout)) {
          that.reply("目前已经是最新版闲心插件了~");
          return;
        }
        if (error) {
          that.reply(
            "闲心插件更新失败！\nError code: " +
              error.code +
              "\n" +
              error.stack +
              "\n 请稍后重试。"
          );
          return;
        }
        that.reply("闲心插件更新成功，正在尝试重新启动Yunzai以应用更新...");
      }
    );
  }
}
