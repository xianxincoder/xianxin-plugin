import plugin from "../../../lib/plugins/plugin.js";
import xxCfg from "../model/xxCfg.js";
import fs from "node:fs";
import fetch from "node-fetch";
import { segment } from "oicq";
import Bilibili from "../model/bilibili.js";
import common from "../../../lib/common/common.js";

let dynamicPushHistory = []; // 历史推送，仅记录推送的消息ID，不记录本体对象，用来防止重复推送的
let nowDynamicPushList = new Map(); // 本次新增的需要推送的列表信息

const BotHaveARest = 500; // 机器人每次发送间隔时间，腹泻式发送会不会不太妥？休息一下吧
const BiliApiRequestTimeInterval = 2000; // B站动态获取api间隔多久请求一次，别太快防止被拉黑

const BiliDrawDynamicLinkUrl = "https://m.bilibili.com/dynamic/"; // 图文动态链接地址前缀

let nowPushDate = Date.now(); // 设置当前推送的开始时间
let pushTimeInterval = 10;
/**
 * 漏推的可能性：
 * 现在基本不存在因请求时间过长导致的漏推
 * 但是没法防止因动态被夹（被官方扣下来了，但是发布时间pub_ts不变），然后放出来的时候真实时间和发布时间不一致的问题
 */
let faultTolerant = 60 * 1000; // 容错时间（允许发布时间和真实时间的时间差），防漏推的，容错时间越长防漏推效果越好，但是对请求的负荷也会越高
let DynamicPushTimeInterval = pushTimeInterval * 60 * 1000 + faultTolerant; // 允许推送多久以前的动态，默认间隔是10分钟

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
      name: "b站相关指令",
      dsc: "b站相关指令",
      event: "message.group",
      priority: 500,
      rule: [
        // {
        //   reg: "^#up.*$",
        //   fnc: "detail",
        // },
        {
          reg: "^#添加up推送\\s*.*$",
          fnc: "addPush",
          permission: "master",
        },
        {
          reg: "^#删除up推送\\s*.*$",
          fnc: "delPush",
          permission: "master",
        },
        {
          reg: "^#up推送列表$",
          fnc: "listPush",
          permission: "master",
        },
        {
          reg: "^#手动推送测试$",
          fnc: "pushTask",
          permission: "master",
        },
      ],
    });
    this.bilibiliSetData = xxCfg.getConfig("bilibili", "set");
    this.bilibiliPushData = xxCfg.getConfig("bilibili", "push");

    /** 定时任务 */
    this.task = {
      cron: this.bilibiliSetData.pushTime,
      name: "检测b站推送定时任务",
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

  /** bilibili推送任务 */
  async pushTask() {
    let data = this.bilibiliPushData || {};

    if (dynamicPushHistory.length === 0) {
      let temp = await redis.get("xianxin:bilipush:history");
      if (!temp) {
        dynamicPushHistory = [];
      } else {
        dynamicPushHistory = JSON.parse(temp);
      }
    }

    // 将上一次推送的动态全部合并到历史记录中
    let hisArr = new Set(dynamicPushHistory);
    for (let [userId, pushList] of nowDynamicPushList) {
      for (let msg of pushList) {
        hisArr.add(msg.id_str);
      }
    }
    dynamicPushHistory = [...hisArr]; // 重新赋值，这个时候dynamicPushHistory就是完整的历史推送了。
    await redis.set(
      "xianxin:bilipush:history",
      JSON.stringify(dynamicPushHistory),
      { EX: 60 * 60 }
    ); // 仅存储一次，过期时间一小时，减小redis消耗

    nowPushDate = Date.now();
    nowDynamicPushList = new Map(); // 清空上次的推送列表

    for (let key in data) {
      const pushList = data[key] || [];

      await this.pushDynamic({ pushList, target: key });
    }
  }

  /** 添加b站推送 */
  async addPush() {
    let uid = this.e.msg.replace(/#添加up推送/g, "").trim();
    if (!uid) {
      this.e.reply(`请输入推送的uid\n示例：#添加up推送 401742377`);
      return true;
    }
    let data = this.bilibiliPushData || {};

    if (!data[this.e.group_id]) data[this.e.group_id] = new Array();

    const existUids = data[this.e.group_id].map((item) => item.uid || "");

    if (existUids.includes(uid)) {
      this.e.reply("这个uid已经添加过了");
      return;
    }

    const res = await new Bilibili(this.e).getBilibiliUserInfo(uid);

    if (!res.ok) {
      this.e.reply("诶嘿，出了点网络问题，等会再试试吧~");
      return;
    }

    const resJson = await res.json();

    if (resJson.code != 0 || !resJson?.data) {
      this.e.reply("uid不对啊老兄，别乱搞哦～");
      return;
    }

    data[this.e.group_id].push({ uid, name: resJson?.data.name });

    this.bilibiliPushData = data;

    xxCfg.saveSet("bilibili", "push", "config", data);

    this.e.reply(`添加b站推送成功~\n${resJson?.data.name}：${uid}`);
  }

  /** 删除b站推送 */
  async delPush() {
    let uid = this.e.msg.replace(/#删除up推送/g, "").trim();
    if (!uid) {
      this.e.reply(`请输入推送的uid\n示例：#删除up推送 401742377`);
      return true;
    }
    let data = this.bilibiliPushData || {};

    if (!data[this.e.group_id]) data[this.e.group_id] = new Array();

    data[this.e.group_id] = data[this.e.group_id].filter(
      (item) => item.uid !== uid
    );

    this.bilibiliPushData = data;

    xxCfg.saveSet("bilibili", "push", "config", data);

    this.e.reply(`删除b站推送成功~\n${uid}`);
  }

  /** b站推送列表 */
  async listPush() {
    let data = this.bilibiliPushData || {};
    if (!data[this.e.group_id]) data[this.e.group_id] = new Array();

    const messages = [];

    data[this.e.group_id].map((item) => {
      messages.push(`${item.uid}  ${item.name}`);
      return item;
    });

    this.e.reply(`推送列表如下：\n${messages.join("\n")}`);
  }

  async detail() {
    let uid = this.e.msg.replace(/#up/g, "");

    const userRes = await fetch(
      `https://api.bilibili.com/x/relation/stat?vmid=${uid}`
    );
    const userResJsonData = await userRes.json();

    const accInfoRes = await fetch(
      `https://api.bilibili.com/x/space/acc/info?mid=${uid}&jsonp=jsonp`
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
      `\n昵称：${data.name}`,
      `\n性别：${data.sex}`,
      `\n等级：${data.level}`,
      `\n粉丝人数：${userResJsonData.data.follower}`,
    ];

    if (data.live_room) {
      message.push(
        `\n\n直播信息`,
        `\n直播标题：${accInfoResJsonData.data.live_room.title}`,
        `\n直播状态：${
          accInfoResJsonData.data.live_room.liveStatus ? "直播中" : "未开播"
        }`,
        `\n直播链接：${accInfoResJsonData.data.live_room.url}`
      );
      if (data.live_room.watched_show) {
        message.push(`\n观看人数：${data.live_room.watched_show.num}人`);
      }
    }

    this.reply(message);
  }

  // 历史推送过的动态，这一轮不推
  rmDuplicatePushList(newList) {
    if (newList && newList.length === 0) return newList;
    return newList.filter((item) => {
      return !dynamicPushHistory.includes(item.id_str);
    });
  }

  // 动态推送
  async pushDynamic(pushInfo) {
    let users = pushInfo.pushList;
    for (let i = 0; i < users.length; i++) {
      let biliUID = users[i].uid;

      // 请求这个B站用户动态之前，先看看刚刚有没有请求过这个B  站用户，有就不需要再请求了
      let lastPushList = nowDynamicPushList.get(biliUID);

      // 刚刚请求过了，不再请求
      if (lastPushList) {
        // 刚刚请求时候就没有可以推送的内容，跳过
        if (lastPushList.length === 0) {
          continue;
        }
        await this.sendDynamic(
          { ...users[i], target: pushInfo.target },
          lastPushList
        );
        continue;
      }

      const response = await new Bilibili(this.e).getBilibiliDynamicInfo(
        biliUID
      );

      if (!response.ok) {
        // 请求失败，不记录，跳过，下一个
        await common.sleep(BiliApiRequestTimeInterval);
        continue;
      }

      const res = await response.json();

      if (res.code != 0) {
        // 同样请求失败，不记录，跳过，下一个
        await common.sleep(BiliApiRequestTimeInterval);
        continue;
      }

      let data = res?.data?.items || [];
      if (data.length === 0) {
        // 没有动态，记录一个空数组，跳过，下一个
        await common.sleep(BiliApiRequestTimeInterval);
        nowDynamicPushList.set(biliUID, []);
        continue;
      }

      let pushList = new Set(); // 满足时间要求的可推送动态列表

      // 获取可以推送的动态列表
      for (let val of data) {
        let author = val?.modules?.module_author || {};
        if (!author?.pub_ts) continue; // 没有推送时间。。。跳过，下一个

        author.pub_ts = author.pub_ts * 1000;
        // 允许推送多早以前的动态，重要，超过了设定时间则不推
        if (nowPushDate - author.pub_ts > DynamicPushTimeInterval) {
          continue;
        }

        pushList.add(val);
      }

      pushList = this.rmDuplicatePushList([...pushList]); // 数据去重，确保不会重复推送
      nowDynamicPushList.set(biliUID, pushList); // 记录本次满足时间要求的可推送动态列表，为空也存，待会再查到就跳过
      if (pushList.length === 0) {
        // 没有可以推送的，记录完就跳过，下一个
        await common.sleep(BiliApiRequestTimeInterval);
        continue;
      }

      await this.sendDynamic(
        { ...users[i], target: pushInfo.target },
        pushList
      );

      await common.sleep(BiliApiRequestTimeInterval);
    }

    return true;
  }

  // 发送动态内容
  async sendDynamic(info, list) {
    let pushID = info.target;
    Bot.logger.mark(`B站动态推送[${pushID}]`);

    for (let val of list) {
      let msg = this.buildSendDynamic(info, val);
      if (msg === "continue") {
        // 这不好在前边判断，只能放到这里了
        continue;
      }
      if (!msg) {
        Bot.logger.mark(
          `B站动态推送[${pushID}] - [${biliUser.name}]，推送失败，动态信息解析失败`
        );
        continue;
      }

      Bot.pickGroup(pushID)
        .sendMsg(msg)
        .catch((err) => {
          pushAgain(pushID, msg);
        });

      await common.sleep(BotHaveARest); // 休息一下，别一口气发一堆
    }

    return true;
  }

  // 构建动态消息
  buildSendDynamic(info, dynamic) {
    let desc, msg, pics;
    let title = `B站【${info.name}】动态推送：\n`;

    // 以下对象结构参考米游社接口，接口在顶部定义了
    switch (dynamic.type) {
      case "DYNAMIC_TYPE_AV":
        desc = dynamic?.modules?.module_dynamic?.major?.archive;
        if (!desc) return;

        title = `B站【${info.name}】视频动态推送：\n`;
        // 视频动态仅由标题、封面、链接组成
        msg = [
          title,
          desc.title,
          segment.image(desc.cover),
          this.resetLinkUrl(desc.jump_url),
        ];

        return msg;
      case "DYNAMIC_TYPE_WORD":
        desc = dynamic?.modules?.module_dynamic?.desc;
        if (!desc) return;

        title = `B站【${info.name}】动态推送：\n`;
        msg = [
          title,
          `${this.dynamicContentLimit(desc.text)}\n`,
          `${BiliDrawDynamicLinkUrl}${dynamic.id_str}`,
        ];

        return msg;
      case "DYNAMIC_TYPE_DRAW":
        desc = dynamic?.modules?.module_dynamic?.desc;
        pics = dynamic?.modules?.module_dynamic?.major?.draw?.items;
        if (!desc && !pics) return;

        const DynamicPicCountLimit =
          this.bilibiliSetData.pushPicCountLimit || 3;

        if (pics.length > DynamicPicCountLimit)
          pics.length = DynamicPicCountLimit; // 最多发DynamicPicCountLimit张图，不然要霸屏了

        pics = pics.map((item) => {
          return segment.image(item.src);
        });

        title = `B站【${info.name}】图文动态推送：\n`;
        // 图文动态由内容（经过删减避免过长）、图片、链接组成
        msg = [
          title,
          `${this.dynamicContentLimit(desc.text)}\n`,
          ...pics,
          `${BiliDrawDynamicLinkUrl}${dynamic.id_str}`,
        ];

        return msg;
      case "DYNAMIC_TYPE_ARTICLE":
        desc = dynamic?.modules?.module_dynamic?.major?.article;
        if (!desc) return;

        pics = [];
        if (desc.covers && desc.covers.length) {
          pics = desc.covers.map((item) => {
            return segment.image(item);
          });
        }

        title = `B站【${info.name}】文章动态推送：\n`;
        // 专栏/文章动态由标题、图片、链接组成
        msg = [title, desc.title, ...pics, this.resetLinkUrl(desc.jump_url)];

        return msg;
      case "DYNAMIC_TYPE_FORWARD": // 转发的动态
        if (!this.bilibiliSetData.pushTransmit) {
          return "continue";
        }

        desc = dynamic?.modules?.module_dynamic?.desc;
        if (!desc) return;
        if (!dynamic.orig) return;

        let orig = this.buildSendDynamic(info, dynamic.orig);
        if (orig && orig.length) {
          // 掐头去尾
          orig.shift();
          orig.pop();
        } else {
          return false;
        }

        title = `B站【${info.name}】转发动态推送：\n`;
        msg = [
          title,
          `${this.dynamicContentLimit(
            desc.text,
            1,
            15
          )}\n---以下为转发内容---\n`,
          ...orig,
          `${BiliDrawDynamicLinkUrl}${dynamic.id_str}`,
        ];

        return msg;
      case "DYNAMIC_TYPE_LIVE_RCMD":
        desc = dynamic?.modules?.module_dynamic?.major?.live_rcmd?.content;
        if (!desc) return;

        desc = JSON.parse(desc);
        desc = desc?.live_play_info;
        if (!desc) return;

        title = `B站【${info.name}】直播动态推送：\n`;
        // 直播动态由标题、封面、链接组成
        msg = [
          title,
          `${desc.title}\n`,
          segment.image(desc.cover),
          this.resetLinkUrl(desc.link),
        ];

        return msg;
      default:
        Bot.logger.mark(`未处理的B站推送【${info.name}】：${dynamic.type}`);
        return false;
    }
  }

  // 限制动态字数/行数，避免过长影响观感（霸屏）
  dynamicContentLimit(content, lineLimit, lenLimit) {
    content = content.split("\n");

    const DynamicContentLenLimit =
      this.bilibiliSetData.pushContentLenLimit || 100;

    const DynamicContentLineLimit =
      this.bilibiliSetData.pushContentLineLimit || 5;

    lenLimit = lenLimit || DynamicContentLenLimit;
    lineLimit = lineLimit || DynamicContentLineLimit;

    if (content.length > lineLimit) content.length = lineLimit;

    let contentLen = 0; // 内容总长度
    let outLen = false; // 溢出 flag
    for (let i = 0; i < content.length; i++) {
      let len = lenLimit - contentLen; // 这一段内容允许的最大长度

      if (outLen) {
        // 溢出了，后面的直接删掉
        content.splice(i--, 1);
        continue;
      }
      if (content[i].length > len) {
        content[i] = content[i].substr(0, len);
        content[i] = `${content[i]}...`;
        contentLen = lenLimit;
        outLen = true;
      }
      contentLen += content[i].length;
    }

    return content.join("\n");
  }

  // B站返回的url有时候多两斜杠，去掉
  resetLinkUrl(url) {
    if (url.indexOf("//") === 0) {
      return url.substr(2);
    }

    return url;
  }
}
