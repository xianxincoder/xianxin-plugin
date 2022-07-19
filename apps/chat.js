import { segment } from "oicq";
import plugin from "../../../lib/plugins/plugin.js";

let tempMsgList = []; // [{qq: xxx, message: xxx, type: xxx}]

export class chat extends plugin {
  constructor() {
    super({
      name: "聊天",
      dsc: "群里好友发的信息，相关处理",
      event: "message.group",
      priority: 800,
      rule: [
        {
          reg: "^.*$",
          fnc: "repeat",
        },
      ],
    });
  }

  /**
   * 检测复读功能
   * 如果不同群友发送信息相同两次 那么小机器人也发送一次相同的信息
   */
  async repeat() {
    if (!this.e.isGroup) return;

    console.log(this.e);
    const info = this.e;

    tempMsgList.push({ qq: info.user_id });

    /** 冷却cd 30s */
    let cd = 30;

    /** cd */
    let key = `Yz:repeat:${this.e.group_id}`;
    if (await redis.get(key)) return;
    redis.set(key, "1", { EX: cd });

    return;

    this.reply("开发中");
  }
}
