import plugin from "../../../lib/plugins/plugin.js";
import common from "../../../lib/common/common.js";

let groups = [];

export class forward extends plugin {
  constructor() {
    super({
      name: "转发",
      dsc: "处理转发小工具",
      event: "message.private",
      priority: 500,
      rule: [
        {
          reg: "^#*转发$",
          fnc: "forward",
          permission: "master",
        },
        {
          reg: "^#*群列表$",
          fnc: "groupList",
          permission: "master",
        },
      ],
    });

    this.forwardRules = [
      {
        reg: "^#*(结束|停止)转发$",
        fuc: "stopForward",
        desc: "#结束转发 -- 结束转发消息状态",
      },
      {
        reg: "^#*选择\\s*.*$",
        fuc: "forwardForSelect",
        desc: "#选择1 2 -- 选择群组，也可#选择全部",
      },
      {
        reg: "^#*戳\\s*.*$",
        fuc: "forwardForPoke",
        desc: "#戳 QQ号  -- 戳一戳群组中的某位群友",
      },
      {
        reg: "^#*退群$",
        fuc: "forwardForQuit",
        desc: "#退群  -- 退出当前转发的群聊",
      },
    ];

    // 加入的群组信息
    this.list = [];
    for (var [key, value] of Bot.gl) {
      this.list.push({ groupName: value.group_name, groupId: key });
    }
  }

  async forward() {
    groups = [];
    // groupId = this.e.msg.replace(/#*转发\s*/g, "") || 0;

    // if (!Bot.gl.get(Number(groupId))) {
    //   this.reply(`未找到当前群组，您加入的群组有\n${this.list.join("\n")}`);
    //   return;
    // }

    this.setContext("doForward", this.e.isGroup, 5 * 60);

    await this.reply(
      `请按照序号选择需要转发的群组，例如：#选择1 2 #选择全部\n${this.list
        .map(
          (item, index) => `${index + 1}. ${item.groupName}(${item.groupId})`
        )
        .join("\n")}`,
      false,
      {
        at: true,
      }
    );
  }

  async doForward() {
    let result = { status: true };

    for (let v of this.forwardRules) {
      if (new RegExp(v.reg).test(this.e.msg)) {
        try {
          if (v.fuc) {
            let res = await eval("this." + v.fuc)(this);
            result = res;
          }
        } catch (error) {
          logger.error(error);
        }
      }
    }

    if (!result.status) {
      if (result.code === "finish") {
        groups = [];
        this.finish("doForward", this.e.isGroup);
      }
      return;
    }

    if (!groups.length) {
      this.e.reply("未检测到有效的群组请先选择转发群组");
      return { status: false };
    }

    groups.map(async (item) => {
      /** 转发内容 */
      Bot.pickGroup(Number(item.groupId))
        .sendMsg(this.e.message)
        .catch((err) => {
          this.reply(
            `${item.groupName}(${item.groupId}) 发送[${
              this.e.message
            }]失败，${JSON.stringify(err)}`
          );
          return;
        });
      await common.sleep(random(1500, 6000));
      return item;
    });
  }

  async forwardForSelect(that) {
    groups = [];
    const groupIndexStr = that.e.msg.replace(/#*选择(全部)?\s*/g, "") || "";

    if (that.e.msg.indexOf("全部") !== -1) {
      groups = that.list;
    } else {
      let indexArr =
        groupIndexStr.split(/[,，\s+]/).filter((item) => !!item) || [];
      that.list.map((item, idx) => {
        if (indexArr.indexOf(`${idx + 1}`) !== -1) {
          groups.push(item);
        }
        return item;
      });
    }
    if (!groups.length) {
      that.reply("未检测到有效的群组请重新选择转发群组");
      return { status: false };
    }

    const prefix = `将要转发的群组为：${groups
      .map((item) => item.groupName)
      .join("、")}\n`;

    /** 回复 */
    await that.reply(
      `${prefix}请发送要转发的内容，其中内置指令如下\n${that.forwardRules
        .map((item) => item.desc)
        .join("\n")}`
    );
    return { status: false };
  }

  async stopForward(e) {
    e.reply("已停止转发");
    return { status: false, code: "finish" };
  }

  async forwardForQuit(e) {
    if (!groups.length) {
      that.reply("未检测到有效的群组请重新选择转发群组");
      return { status: false };
    }

    groups.map(async (item) => {
      Bot.pickGroup(Number(item.groupId)).quit();
      e.reply(`已退群[${item.groupId}]`);
      await common.sleep(600);
      return item;
    });

    return { status: false };
  }

  async forwardForPoke(that) {
    if (!groups.length) {
      that.reply("未检测到有效的群组请重新选择转发群组");
      return { status: false };
    }
    const uid = that.e.msg.replace(/#*戳\s*/g, "") || Bot.uin;
    groups.map(async (item) => {
      await Bot.pickGroup(Number(item.groupId)).pokeMember(uid);
      that.e.reply(`已戳[${uid}]`);
      await common.sleep(600);
      return item;
    });
    return { status: false, code: "" };
  }

  groupList() {
    this.reply(
      `目前加入的群组有\n${this.list
        .map(
          (item, index) => `${index + 1}. ${item.groupName}(${item.groupId})`
        )
        .join("\n")}`
    );
  }

  random(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
  }
}
