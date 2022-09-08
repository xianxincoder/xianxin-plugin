import plugin from "../../../lib/plugins/plugin.js";

let groupId = "";

export class forward extends plugin {
  constructor() {
    super({
      name: "转发",
      dsc: "处理转发小工具",
      event: "message.private",
      priority: 500,
      rule: [
        {
          reg: "^#*转发\\s*[0-9]{5,11}$",
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
      this.list.push(`${value.group_name} ${key}`);
    }
  }

  async forward() {
    groupId = this.e.msg.replace(/#*转发\s*/g, "") || 0;

    if (!Bot.gl.get(Number(groupId))) {
      this.reply(`未找到当前群组，您加入的群组有\n${this.list.join("\n")}`);
      return;
    }

    this.setContext("doForward", this.e.isGroup, 5 * 60);
    /** 回复 */
    await this.reply(
      `请发送要转发的内容，其中内置指令如下\n${this.forwardRules
        .map((item) => item.desc)
        .join("\n")}`,
      false,
      {
        at: true,
      }
    );
  }

  async doForward() {
    if (this.e.isGroup) {
      return;
    }

    let result = { stats: true };

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

    if (!result.stats) {
      if (result.code === "finish") {
        this.finish("doForward", this.e.isGroup);
      }
      return;
    }

    /** 转发内容 */
    Bot.pickGroup(Number(groupId))
      .sendMsg(this.e.message)
      .catch((err) => {
        this.reply("发送失败，请确认发送的群号正确");
        return;
      });
  }

  async stopForward(e) {
    e.reply("已停止转发");
    return { status: false, code: "finish" };
  }

  async forwardForQuit(e) {
    Bot.pickGroup(Number(groupId)).quit();
    e.reply(`已退群[${groupId}]`);
  }

  async forwardForPoke(that) {
    const uid = that.e.msg.replace(/#*戳\s*/g, "") || Bot.uin;
    const result = await Bot.pickGroup(Number(groupId)).pokeMember(uid);

    that.e.reply(`已戳[${uid}]`);
    return { status: false, code: "" };
  }

  groupList() {
    this.reply(`目前加入的群组有\n${this.list.join("\n")}`);
  }
}
