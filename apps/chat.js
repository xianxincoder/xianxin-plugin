import { segment } from "oicq";
import plugin from "../../../lib/plugins/plugin.js";

// 存放接收到的两条信息
let tempMsg = {};

export class chat extends plugin {
  constructor() {
    super({
      name: "聊天",
      dsc: "群里好友发的信息，相关处理",
      event: "message.group",
      priority: 999,
      rule: [
        {
          reg: "^(?!.*#).*$",
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
    // 如果不是群聊那么直接停止
    if (!this.e.isGroup) return;

    const info = this.e;

    // 如果消息过于复杂那么直接停止
    if (info.message.length > 1) return;

    const message = info.message[0];

    let tempMsgList = tempMsg[info.group_id] || [];

    if (message.type === "text" || message.type === "face") {
      tempMsgList.push({
        qq: info.user_id,
        message: message.text,
        type: message.type,
      });
    } else if (message.type === "image") {
      tempMsgList.push({
        qq: info.user_id,
        message: message.file,
        type: message.type,
      });
    } else {
      return;
    }

    tempMsg[info.group_id] = tempMsgList;

    if (tempMsgList.length < 3) return;

    if (tempMsgList.length > 3) {
      tempMsgList = tempMsgList.slice(tempMsgList.length - 3);
      tempMsg[info.group_id] = tempMsgList;
    }

    const messageSet = new Set(tempMsgList.map((item) => item.message));

    if (messageSet.size < 3) {
      /** 冷却cd 300s */
      let cd = 300;

      /** cd */
      let key = `Yz:repeat:${this.e.group_id}`;
      if (await redis.get(key)) return;
      redis.set(key, "1", { EX: cd });
      tempMsg[info.group_id] = [];

      this.reply(info.message);
    }
  }
}
