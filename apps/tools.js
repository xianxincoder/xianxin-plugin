import plugin from "../../../lib/plugins/plugin.js";
import common from "../../../lib/common/common.js";
import fetch from "node-fetch";
import moment from "moment";
import lodash from "lodash";

export class tools extends plugin {
  constructor() {
    super({
      name: "闲心小工具",
      dsc: "处理一些杂项小工具",
      event: "message",
      priority: 5000,
      rule: [
        {
          reg: "^#*赞我$",
          fnc: "thumbsUpMe",
        },
        {
          reg: "^#*潜水\\s*(踢)?\\s*[0-9]*$",
          fnc: "lurk",
          permission: "master",
        },
        {
          reg: "^#*大地图\\s*.*$",
          fnc: "map",
        },
      ],
    });
  }

  /**
   * rule - #赞我
   * @returns
   */
  async thumbsUpMe() {
    Bot.pickFriend(this.e.user_id).thumbUp(10);
    this.e.reply("已给你点赞");
  }

  async lurk() {
    let days = this.e.msg.replace(/#*潜水\s*(踢)?\s*/g, "").trim() || 0;

    const isKickMember = this.e.msg.indexOf("踢") !== -1;

    let gl = await this.e.group.getMemberMap();

    let msg = [];
    let users = [];

    for (let [k, v] of gl) {
      if (days == 0) {
        if (v.last_sent_time == v.join_time) {
          //计算相差多少天
          let diffDay = moment().diff(moment.unix(v.join_time), "day");
          msg.push(
            `${v.nickname}(${v.user_id}) 入群${diffDay}天，一直在潜水。`
          );
          users.push(v.user_id);
        }
      } else {
        //计算相差多少天
        let diffDay = moment().diff(moment.unix(v.last_sent_time), "day");
        if (diffDay >= days) {
          msg.push(
            `${v.nickname}(${v.user_id}) 已潜水${diffDay}天了，该出来冒个泡啦！`
          );
          users.push(v.user_id);
        }
      }
    }

    let total = msg.length;

    const msgArr = lodash.chunk(msg, 10);

    const groupmsg = msgArr.map((item) => {
      return item.join("\n");
    });

    msg = await common.makeForwardMsg(
      this.e,
      groupmsg,
      days
        ? `潜水超过${days}天的群友共${total}个`
        : `入群从未发言的群友共${total}个`
    );

    await this.e.reply(msg);

    if (isKickMember && users.length && this.e.group.is_admin) {
      for (let index = 0; index < users.length; index++) {
        const element = users[index];
        await common.sleep(600);
        this.e.group.kickMember(element);
        await this.addOutGroupBlack(element);
      }
    }
  }

  async map() {
    let keyword = this.e.msg.replace(/#*大地图\s*/g, "").trim() || "传送点";

    const headers = {
      Referer: "https://bbs.mihoyo.com/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
    };

    const fetchData = await fetch(
      `https://waf-api-takumi.mihoyo.com/common/map_user/ys_obc/v1/map/label/tree?map_id=2&app_sn=ys_obc&lang=zh-cn`,
      { method: "get", headers }
    );

    const resJsonData = await fetchData.json();

    if (resJsonData.retcode != 0 && resJsonData.data.tree) {
      this.e.reply("接口异常，请稍后重试");
      return;
    }

    const list = resJsonData.data.tree;

    let id = 0;
    let fuzzId = 0;

    let fuzzName = "";

    list.map((item) => {
      if (id != 0) {
        return item;
      }
      if (item.name == keyword) {
        id = item.id;
      }
      if (item.name.indexOf(keyword) !== -1) {
        fuzzId = item.id;
        fuzzName = item.name;
      }
      if (item.children && item.children.length && id == 0) {
        item.children.map((subItem) => {
          if (id != 0) {
            return subItem;
          }
          if (subItem.name == keyword) {
            id = subItem.id;
          }
          if (subItem.name.indexOf(keyword) !== -1) {
            fuzzId = subItem.id;
            fuzzName = subItem.name;
          }
        });
      }
    });

    if (id == 0 && fuzzId == 0) {
      this.e.reply(`未找到${keyword}，可以换一个词试试`);
      return;
    }

    this.e.reply(
      `${
        fuzzName || keyword
      }大地图分布链接：\nhttps://webstatic.mihoyo.com/ys/app/interactive-map/index.html?lang=zh-cn#/map/2?zoom=-1.00&default_shown=${
        id || fuzzId
      }&hidden-ui=true`
    );
  }

  async addOutGroupBlack(user_id) {
    let blackkey = `Yz:newblackcomers:${this.e.group_id}`;

    let blackcomers = await redis.get(blackkey);

    const { blacks = [] } = blackcomers ? JSON.parse(blackcomers) : {};

    let blackcomersSet = new Set(blacks);

    blackcomersSet.add(user_id);

    await redis.set(
      blackkey,
      JSON.stringify({ blacks: Array.from(blackcomersSet) })
    );
  }
}
