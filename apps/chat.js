import { segment } from "oicq";
import lodash from "lodash";
import xxCfg from "../model/xxCfg.js";
import fs from "node:fs";
import plugin from "../../../lib/plugins/plugin.js";

// 存放接收到的两条信息
let tempMsg = {};

/**
 * 监听所有消息时，如果想不拦截其他插件消息
 * 不要return空值 改为return false就会继续向下执行
 * 也可以用accept(接受到消息都会执行一次)处理，具体看代码
 */

export class chat extends plugin {
  constructor() {
    super({
      name: "聊天",
      dsc: "群里好友发的信息，相关处理",
      event: "message.group",
      priority: 999,
      rule: [
        {
          reg: "^#*(开启|关闭)复读$",
          fnc: "switchRepeat",
        },
        {
          reg: "^#伪造信息.*$",
          fnc: "forge",
        },
      ],
    });

    this.chatSetData = xxCfg.getdefSet("chat", "chat");
  }

  async accept() {
    // 如果未开启那么直接终止
    if (this.chatSetData.closedRepeatGroups.includes(this.e.group_id)) return;

    // 如果不是群聊那么直接停止
    if (!this.e.isGroup) return;

    // 如果是命令消息那么不处理
    if (!/^(?!.*#).*$/.test(this.e.msg)) return;

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
      return "return";
    }
  }

  async switchRepeat() {
    if (!this.e.isGroup) return;
    if (!this.e.isMaster) {
      e.reply("哒咩，只有主人可以命令我哦～");
      return;
    }

    let data = this.chatSetData;

    if (this.e.msg.includes("关闭")) {
      data.closedRepeatGroups = Array.from(
        new Set([...data.closedRepeatGroups, this.e.group_id])
      );
      this.reply("复读已关闭");
    } else if (this.e.msg.includes("开启")) {
      data.closedRepeatGroups = data.closedRepeatGroups.filter(
        (item) => item !== this.e.group_id
      );
      this.reply("复读已开启");
    }

    xxCfg.saveSet("chat", "chat", "defSet", data);
  }

  async forge() {
    let list = [1484288448]; //禁止伪造的qq放到这里 例如 [1484288448,12345678]

    let msgInfo = new Map(); // 将消息通过Map存储起来
    let msg = []; // 将要伪造的所有消息
    let idx = 1;

    //存放@的所有人并通过Set去重
    let qqList = new Set();

    let tempAtInfo = {};

    // 通过@某个人后this.message将会被拆分，将详细放入到Map中
    for (let index = 0; index < this.e.message.length; index++) {
      let element = this.e.message[index];
      if (element.text) {
        element.text = element.text.replace(/#伪造信息/g, "").trim();
      }

      if (element.type == "at") {
        const key = idx;
        msgInfo.set(key, {
          qq: element.qq,
          name: element.text.replace(/@/g, ""),
          msg: "",
        });
        tempAtInfo = {
          key,
          qq: element.qq,
          name: element.text.replace(/@/g, ""),
          msg: "",
        };
        idx++;
        qqList.add(element.qq);
      }
      if (element.type == "text" && element.text && tempAtInfo.key) {
        msgInfo.set(tempAtInfo.key, {
          qq: tempAtInfo.qq,
          name: tempAtInfo.name,
          msg: element.text,
          type: element.type,
        });
      }

      if (element.type == "image" && element.url && tempAtInfo.key) {
        msgInfo.set(tempAtInfo.key, {
          qq: tempAtInfo.qq,
          name: tempAtInfo.name,
          msg: element.text,
          type: element.type,
          url: element.url,
        });
      }
    }

    // 处理如果出现禁止伪造的qq
    if (lodash.intersection(list, Array.from(qqList)).length > 0) {
      this.reply("这位大人的消息禁止被伪造");
      return true;
    }

    for (let item of msgInfo.keys()) {
      const tempMsg = msgInfo.get(item);
      let tempMsgList = [];
      if (tempMsg.type === "image") {
        tempMsgList = [segment.image(tempMsg.url)];
      } else {
        tempMsgList = tempMsg.msg.split(/[|｜]/); // 这里处理消息中如果存在|｜时拆分同一个人发送的多条消息
      }
      tempMsgList.map((msgItem) => {
        msg.push({
          message: msgItem,
          nickname: tempMsg.name,
          user_id: tempMsg.qq,
        });
      });
    }

    this.reply(await this.e.group.makeForwardMsg(msg));
  }
}
