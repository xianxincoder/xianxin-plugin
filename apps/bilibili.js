import plugin from "../../../lib/plugins/plugin.js";
import xxCfg from "../model/xxCfg.js";
import fs from "node:fs";
import fetch from "node-fetch";
import Bilibili from "../model/bilibili.js";

let bilibiliSetFile = "./plugins/xianxin-plugin/config/bilibili.set.yaml";
if (!fs.existsSync(bilibiliSetFile)) {
  fs.copyFileSync(
    "./plugins/xianxin-plugin/defSet/bilibili/set.yaml",
    bilibiliSetFile
  );
}

let bilibiliPushFile = "./plugins/xianxin-plugin/config/bilibili.push.yaml";
if (!fs.existsSync(bilibiliPushFile)) {
  fs.copyFileSync(
    "./plugins/xianxin-plugin/defSet/bilibili/push.yaml",
    bilibiliPushFile
  );
}

export class bilibili extends plugin {
  constructor() {
    super({
      name: "B站功能",
      dsc: "b站相关指令",
      event: "message.group",
      priority: 500,
      rule: [
        {
          reg: "^#*up\\s*[0-9]*$",
          fnc: "detail",
        },
        {
          reg: "^#*(添加|订阅|新增|增加)up推送\\s*(直播\\s*|视频\\s*|图文\\s*|文章\\s*|转发\\s*|直播\\s*)*.*$",
          fnc: "addPush",
          permission: "master",
        },
        {
          reg: "^#*(删除|取消|移除|去除)up推送\\s*(直播\\s*|视频\\s*|图文\\s*|文章\\s*|转发\\s*|直播\\s*)*.*$",
          fnc: "delPush",
          permission: "master",
        },
        {
          reg: "^#*推送(up)?列表$",
          fnc: "listPush",
          permission: "master",
        },
        {
          reg: "^#*搜索up.*$",
          fnc: "searchup",
          permission: "master",
        },
        {
          reg: "^#*手动推送up$",
          fnc: "newPushTask",
          permission: "master",
        },
      ],
    });
    this.bilibiliSetData = xxCfg.getConfig("bilibili", "set");
    this.bilibiliPushData = xxCfg.getConfig("bilibili", "push");

    /** 定时任务 */
    this.task = {
      cron: !!this.bilibiliSetData.pushStatus
        ? this.bilibiliSetData.pushTime
        : "",
      name: "检测b站推送定时任务",
      fnc: () => this.newPushTask(),
      log: !!this.bilibiliSetData.pushTaskLog,
    };
  }

  async newPushTask() {
    let bilibili = new Bilibili(this.e);
    await bilibili.upTask();
  }

  /** 添加b站推送 */
  async addPush() {
    let uid = this.e.msg
      .replace(
        /#*(添加|订阅|新增|增加)up推送\s*(直播\s*|视频\s*|图文\s*|文章\s*|转发\s*|直播\s*)*/g,
        ""
      )
      .trim();
    // (直播\\s*|视频\\s*|图文\\s*|文章\\s*|转发\\s*|直播\\s*)*
    if (!uid) {
      this.e.reply(
        `请输入推送的uid\n示例1(订阅全部动态)：#订阅up推送 401742377\n示例2(订阅直播动态)：#订阅up推送 直播 401742377\n示例3(订阅直播、转发、图文、文章、视频动态)：#订阅up推送 直播 转发 图文 文章 视频 401742377`
      );
      return true;
    }

    let data = this.bilibiliPushData || {};

    if (!data[this.e.group_id]) data[this.e.group_id] = new Array();

    // const existUids = data[this.e.group_id].map((item) => item.uid || "");

    const upData = data[this.e.group_id].find((item) => item.uid == uid);

    if (upData) {
      data[this.e.group_id].map((item) => {
        if (item.uid == uid) {
          item.type = this.typeHandle(item, this.e.msg, "add");
        }
        return item;
      });

      this.bilibiliPushData = data;
      xxCfg.saveSet("bilibili", "push", "config", data);
      this.e.reply(`修改b站推送动态类型成功~\n${upData.name}：${uid}`);
      return;
    }

    // const res = await new Bilibili(this.e).getBilibiliUserInfo(uid);

    const res = await new Bilibili(this.e).getBilibiliDynamicInfo(uid);

    if (!res.ok) {
      this.e.reply("诶嘿，出了点网络问题，等会再试试吧~");
      return;
    }

    const resJson = await res.json();

    if (resJson.code != 0 || !resJson?.data) {
      this.e.reply(
        "uid不对啊老兄，别乱搞哦～\n示例1(订阅全部动态)：#订阅up推送 401742377\n示例2(订阅直播动态)：#订阅up推送 直播 401742377\n示例3(订阅直播、转发、图文、文章、视频动态)：#订阅up推送 直播 转发 图文 文章 视频 401742377"
      );
      return;
    }

    const dynamics = resJson?.data?.items || [];

    let name = uid;

    if (dynamics.length) {
      let dynamic = dynamics[0];
      name = dynamic?.modules?.module_author?.name || uid;
    }

    data[this.e.group_id].push({
      uid,
      name: name,
      type: this.typeHandle(
        {
          uid,
          name,
        },
        this.e.msg,
        "add"
      ),
    });

    this.bilibiliPushData = data;

    xxCfg.saveSet("bilibili", "push", "config", data);

    this.e.reply(`添加b站推送成功~\n${name}：${uid}`);
  }

  /** 删除b站推送 */
  async delPush() {
    let uid = this.e.msg
      .replace(
        /#*(删除|取消|移除|去除)up推送\s*(直播\s*|视频\s*|图文\s*|文章\s*|转发\s*|直播\s*)*/g,
        ""
      )
      .trim();
    if (!uid) {
      this.e.reply(
        `请输入推送的uid\n示例1(取消全部动态推送)：#取消up推送 401742377\n示例2(取消订阅直播动态)：#取消up推送 直播 401742377\n示例3(取消订阅直播、转发、图文、文章、视频动态)：#取消up推送 直播 转发 图文 文章 视频 401742377`
      );
      return;
    }
    let data = this.bilibiliPushData || {};

    if (!data[this.e.group_id]) data[this.e.group_id] = new Array();

    const upData = data[this.e.group_id].find((item) => item.uid == uid);

    if (!upData) {
      this.e.reply(
        `未找到该uid，请核实是否输入指令正确\n示例1(取消全部动态推送)：#取消up推送 401742377\n示例2(取消订阅直播动态)：#取消up推送 直播 401742377\n示例3(取消订阅直播、转发、图文、文章、视频动态)：#取消up推送 直播 转发 图文 文章 视频 401742377`
      );
      return;
    }

    const newType = this.typeHandle(upData, this.e.msg, "del");

    let isDel = false;

    if (newType.length) {
      data[this.e.group_id].map((item) => {
        if (item.uid == uid) {
          item.type = newType;
        }
        return item;
      });
    } else {
      isDel = true;
      data[this.e.group_id] = data[this.e.group_id].filter(
        (item) => item.uid !== uid
      );
    }

    this.bilibiliPushData = data;

    xxCfg.saveSet("bilibili", "push", "config", data);

    this.e.reply(`${isDel ? "删除" : "修改"}b站推送成功~\n${uid}`);
  }

  /** b站推送列表 */
  async listPush() {
    let data = this.bilibiliPushData || {};
    if (!data[this.e.group_id]) data[this.e.group_id] = new Array();

    const messages = [];

    const typeMap = {
      DYNAMIC_TYPE_AV: "视频",
      DYNAMIC_TYPE_WORD: "图文",
      DYNAMIC_TYPE_DRAW: "图文",
      DYNAMIC_TYPE_ARTICLE: "文章",
      DYNAMIC_TYPE_FORWARD: "转发",
      DYNAMIC_TYPE_LIVE_RCMD: "直播",
    };

    data[this.e.group_id].map((item) => {
      const types = new Set();

      if (item.type && item.type.length) {
        item.type.map((typeItem) => {
          types.add(typeMap[typeItem]);
          return typeItem;
        });
      }

      messages.push(
        `${item.uid}  ${item.name}${
          types.size ? `[${Array.from(types).join("、")}]` : "[全部动态]"
        }`
      );
      return item;
    });

    this.e.reply(`推送列表如下：\n${messages.join("\n")}`);
  }

  async detail() {
    let uid = this.e.msg.replace(/#*up/g, "").trim();

    const accInfoRes = await new Bilibili(this.e).getBilibiliUserInfoDetail(
      uid
    );

    if (!accInfoRes.ok) {
      this.reply("诶嘿，出了点网络问题，等会再试试吧~");
      return true;
    }

    const accInfoResJsonData = await accInfoRes.json();

    const data = accInfoResJsonData?.data || null;

    if (accInfoResJsonData.code != 0 || !data) {
      this.reply("UID不对啊老兄，别乱搞哦～");
      return true;
    }
    const message = [
      `昵称：${data.card.name}`,
      `\n性别：${data.card.sex}`,
      `\n等级：${data.card.level_info.current_level}`,
      `\n粉丝人数：${data.card.fans}`,
    ];

    if (data.live) {
      message.push(
        `\n\n直播信息`,
        `\n直播标题：${data.live.title}`,
        `\n直播状态：${data.live.liveStatus ? "直播中" : "未开播"}`,
        `\n直播链接：${data.live.url}`
      );
      // if (data.live_room.watched_show) {
      //   message.push(`\n观看人数：${data.live_room.watched_show.num}人`);
      // }
    }

    this.reply(message);
  }

  /**
   * rule - 根据名称搜索up信息
   */
  async searchup() {
    let keyword = this.e.msg.replace(/#*搜索up/g, "").trim();

    let response = await new Bilibili(this.e).getBilibiliUp(keyword);
    if (!response.ok) {
      this.reply("诶嘿，出了点网络问题，等会再试试吧~");
      return;
    }

    const res = await response.json();

    if (res.code !== 0 || !res.data.result || !res.data.result.length) {
      this.reply("没有搜索到该用户，请换个关键词试试吧");
      return;
    }

    const messages = [];

    res.data.result.map((item, index) => {
      if (index < 5) {
        messages.push(
          `${item.uname}\nUID：${item.mid}\n粉丝数：${item.fans}${
            index < 4 ? "\n" : ""
          }`
        );
      }
      return item;
    });

    this.e.reply(messages.join("\n"));
  }

  typeHandle(up, msg, type) {
    let newType = new Set(up.type || []);
    if (type == "add") {
      if (msg.indexOf("直播") !== -1) {
        newType.add("DYNAMIC_TYPE_LIVE_RCMD");
      }
      if (msg.indexOf("转发") !== -1) {
        newType.add("DYNAMIC_TYPE_FORWARD");
      }
      if (msg.indexOf("文章") !== -1) {
        newType.add("DYNAMIC_TYPE_ARTICLE");
      }
      if (msg.indexOf("图文") !== -1) {
        newType.add("DYNAMIC_TYPE_DRAW");
        newType.add("DYNAMIC_TYPE_WORD");
      }
      if (msg.indexOf("视频") !== -1) {
        newType.add("DYNAMIC_TYPE_AV");
      }
    } else if (type == "del") {
      if (!newType.size) {
        newType = new Set([
          "DYNAMIC_TYPE_LIVE_RCMD",
          "DYNAMIC_TYPE_FORWARD",
          "DYNAMIC_TYPE_ARTICLE",
          "DYNAMIC_TYPE_DRAW",
          "DYNAMIC_TYPE_WORD",
          "DYNAMIC_TYPE_AV",
        ]);
      }

      let isDelType = false;

      if (msg.indexOf("直播") !== -1) {
        newType.delete("DYNAMIC_TYPE_LIVE_RCMD");
        isDelType = true;
      }
      if (msg.indexOf("转发") !== -1) {
        newType.delete("DYNAMIC_TYPE_FORWARD");
        isDelType = true;
      }
      if (msg.indexOf("文章") !== -1) {
        newType.delete("DYNAMIC_TYPE_ARTICLE");
        isDelType = true;
      }
      if (msg.indexOf("图文") !== -1) {
        newType.delete("DYNAMIC_TYPE_DRAW");
        newType.delete("DYNAMIC_TYPE_WORD");
        isDelType = true;
      }
      if (msg.indexOf("视频") !== -1) {
        newType.delete("DYNAMIC_TYPE_AV");
        isDelType = true;
      }
      if (!isDelType) {
        newType.clear();
      }
    }
    return Array.from(newType);
  }
}
