import { segment } from "oicq";
import lodash from "lodash";
import plugin from "../../../lib/plugins/plugin.js";

/**
 * 功能：伪造QQ转发信息
 *
 * 使用实例
 * 1、
 * 输入：#伪造信息@闲心测试1｜测试2|测试3
 * 输出：
 * 闲心：测试1
 * 闲心：测试2
 * 闲心：测试3
 * 2、
 * 输入：#伪造信息@闲心测试1@派蒙测试2@闲心测试3｜测试4
 * 输出：
 * 闲心：测试1
 * 派蒙：测试2
 * 闲心：测试3
 * 闲心：测试4
 * 3、
 * 输入：#伪造信息@派蒙来个图片@闲心图片@派蒙可以哦
 * 输出：
 * 派蒙：来个图片
 * 闲心：图片
 * 派蒙：可以哦
 */

//命令规则
// export const rule = {
//   forge: {
//     reg: "^#伪造信息.*$", //匹配消息正则，命令正则
//     priority: 500, //优先级，越小优先度越高
//     describe: "【#伪造信息@群成员 信息】开发简单示例演示", //【命令】功能说明
//   },
// };

export class forge extends plugin {
  constructor() {
    super({
      name: "伪造信息",
      dsc: "伪造群里好友的信息",
      event: "message",
      priority: 500,
      rule: [
        {
          reg: "^#伪造信息.*$",
          fnc: "forge",
        },
      ],
    });
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
