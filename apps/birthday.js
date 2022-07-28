import { segment } from "oicq";
import lodash from "lodash";
import plugin from "../../../lib/plugins/plugin.js";
import xxCfg from "../model/xxCfg.js";
import fs from "node:fs";
import moment from "moment";
import common from "../../../lib/common/common.js";
import Birthday from "../model/birthday.js";
import puppeteer from "../../../lib/puppeteer/puppeteer.js";

let birthdaySetFile = "./plugins/xianxin-plugin/config/role.set.yaml";
if (!fs.existsSync(birthdaySetFile)) {
  fs.copyFileSync(
    "./plugins/xianxin-plugin/defSet/role/set.yaml",
    birthdaySetFile
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
        {
          reg: "^#.*生日图片$",
          fnc: "image",
        },
      ],
    });

    this.birthdaySetData = xxCfg.getConfig("role", "set");
    this.birthdayCfgData = xxCfg.getdefSet("role", "birthday");

    /** 定时任务 */
    this.task = {
      cron: this.birthdaySetData.pushTime,
      name: "检测角色生日定时任务",
      fnc: () => this.pushTask(),
    };
  }

  // 群推送失败了，再推一次，再失败就算球了
  async pushAgain(groupId, msg) {
    await common.sleep(10000);
    Bot.pickGroup(groupId)
      .sendMsg(msg)
      .catch((err) => {
        logger.error(`群[${groupId}]推送失败：${err}`);
      });

    return;
  }

  /** 生日推送任务 */
  async pushTask() {
    const pushList = this.birthdayCfgData.openPushGroups || [];
    // 如果没有推送群那么暂停
    if (!pushList.length) {
      return;
    }

    const currentDate = moment().format("MM-DD");

    const birthdayData = this.birthdayCfgData.birthday;

    const roles = birthdayData[currentDate] || [];

    if (!roles.length) {
      return;
    }

    for (let pushItem of pushList) {
      for (let roleItem of roles) {
        const data = await new Birthday(this.e).getData(
          pushItem,
          roleItem.name,
          roleItem.content
        );
        let img = await puppeteer.screenshot("birthday", data);

        if (img) {
          Bot.pickGroup(pushItem)
            .sendMsg(img)
            .catch((err) => {
              // 推送失败，重试一次
              pushAgain(pushItem, img);
            });

          await common.sleep(1000);
        }
      }
    }
  }

  /** 开启 */
  async switchTask() {
    if (!this.e.isGroup) return;
    if (!this.e.isMaster) {
      e.reply("哒咩，只有主人可以命令我哦～");
      return;
    }

    let data = this.birthdayCfgData;

    if (this.e.msg.includes("开启")) {
      data.openPushGroups = Array.from(
        new Set([...data.openPushGroups, this.e.group_id])
      );
      this.reply("生日推送已开启");
    } else if (this.e.msg.includes("关闭")) {
      data.openPushGroups = data.openPushGroups.filter(
        (item) => item !== this.e.group_id
      );
      this.reply("生日推送已关闭");
    }

    xxCfg.saveSet("role", "birthday", "defSet", data);
  }

  async image() {
    let role = this.e.msg.replace(/#/g, "").replace(/生日图片/g, "");
    const imagePath = `./plugins/xianxin-plugin/resources/img/birthday/${role}.jpeg`;

    if (fs.existsSync(imagePath)) {
      let msg = segment.image(imagePath);
      this.reply(msg);
    } else {
      this.reply("角色没有找到哦～");
    }
  }
}
