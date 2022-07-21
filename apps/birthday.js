import { segment } from "oicq";
import lodash from "lodash";
import plugin from "../../../lib/plugins/plugin.js";
import xxCfg from "../model/xxCfg.js";
import fs from "node:fs";

let birthdayFile = "./plugins/xianxin-plugin/config/role.birthday.yaml";
if (!fs.existsSync(birthdayFile)) {
  fs.copyFileSync(
    "./plugins/xianxin-plugin/defSet/role/birthday.yaml",
    birthdayFile
  );
}

/**
 * 处理原神角色中生日，向群众推送生日消息(后续群内成员生日，看看是否可以一起处理，增加群活跃度)
 */
export class birthday extends plugin {
  constructor() {
    super({
      name: "生日",
      dsc: "处理原神角色中生日，向群众推送生日消息(后续群内成员生日，看看是否可以一起处理，增加群活跃度)",
      event: "message",
      priority: 800,
      rule: [
        {
          reg: "^#*(开启|关闭)生日推送$",
          fnc: "switchTask",
        },
      ],
    });

    this.birthdayCfgData = xxCfg.getConfig("role", "birthday");

    /** 定时任务 */
    this.task = {
      cron: this.birthdayCfgData.pushTime,
      name: "检测角色生日定时任务",
      fnc: () => this.pushTask(),
    };
  }

  /** 生日推送任务 */
  async pushTask() {
    const pushList = this.birthdayCfgData.openPushGroups || [];
    console.log(pushList);
    // 如果没有推送群那么暂停
    if (!pushList.length) {
      return;
    }

    // todo: 拿到日期，然后从配置文件中找到角色 然后进行推送
  }

  /** 开启 */
  async switchTask() {
    if (!this.e.isGroup) return;
    if (!this.e.isMaster) {
      e.reply("哒咩，只有主人可以命令我哦～");
      return;
    }

    let data = this.birthdayCfgData;

    console.log(data);

    if (this.e.msg.includes("开启")) {
      data.openPushGroups = Array.from(
        new Set([...data.openPushGroups, this.e.group_id])
      );
    } else if (this.e.msg.includes("关闭")) {
      data.openPushGroups = data.openPushGroups.filter(
        (item) => item !== this.e.group_id
      );
    }

    xxCfg.saveBirthday("role", "birthday", "defSet", data);
  }
}
