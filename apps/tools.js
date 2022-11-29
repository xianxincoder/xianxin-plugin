import plugin from "../../../lib/plugins/plugin.js";
import common from "../../../lib/common/common.js";
import fetch from "node-fetch";
import moment from "moment";
import lodash from "lodash";
import fs from "node:fs";
import xxCfg from "../model/xxCfg.js";

import { Restart } from "../../other/restart.js";

const _path = process.cwd();

const cacheDirs = [
  {
    name: "data/",
    path: `${_path}/data/`,
    clearReg: /^[a-z0-9]{32}$/,
  },
  {
    name: "data/image/",
    path: `${_path}/data/image/`,
    clearReg: /^[a-z0-9]{32}$/,
  },
];

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
        {
          reg: "^#*清理缓存文件$",
          fnc: "clearCache",
          permission: "master",
        },
        {
          reg: "^#*清理无效数据$",
          fnc: "clearInvalidData",
          permission: "master",
        },
      ],
    });

    this.bilibiliPushData = xxCfg.getConfig("bilibili", "push");
    this.pkJsonPath = "./data/pkJson/";
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
        // await this.addOutGroupBlack(element);
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

  async clearCache() {
    let dataCount = 0;

    cacheDirs.forEach(async (dirItem, dirIndex) => {
      const cachefiles = fs.readdirSync(dirItem.path);
      await this.e.reply(`开始清理${dirItem.name}缓存文件...`);

      await cachefiles.forEach(async (file) => {
        if (new RegExp(dirItem.clearReg).test(file)) {
          fs.unlinkSync(dirItem.path + file);
          dataCount++;
        }
      });

      if (dirIndex == cacheDirs.length - 1) {
        await this.e.reply(`清理完成，共清理缓存文件：${dataCount}个`);
      }
    });
  }

  async clearInvalidData() {
    /** 有效群数据 */
    const validGroupList = Array.from(Bot.gl.keys());

    /** 群有效用户数据 */
    const gfl = {};
    let pkArr = {};

    for (let index = 0; index < validGroupList.length; index++) {
      let gflMap = await Bot.pickGroup(
        Number(validGroupList[index])
      ).getMemberMap();
      gfl[validGroupList[index]] = Array.from(gflMap.keys());

      let path = `${this.pkJsonPath}${validGroupList[index]}.json`;
      if (fs.existsSync(path)) {
        pkArr[validGroupList[index]] = new Map();
        let pkMapJson = JSON.parse(fs.readFileSync(path, "utf8"));
        for (let key in pkMapJson) {
          pkArr[validGroupList[index]].set(String(key), pkMapJson[key]);
        }
      }
    }

    if (validGroupList.length) {
      await this.e.reply("清理无效b站推送群");
      let data = this.bilibiliPushData || {};
      let upKeys = Object.keys(data);

      for (let index = 0; index < upKeys.length; index++) {
        if (!validGroupList.includes(Number(upKeys[index]))) {
          console.log(data[upKeys[index]]);
          delete data[upKeys[index]];
        }
      }

      xxCfg.saveSet("bilibili", "push", "config", data);

      await this.e.reply("清理群战中无效成员信息");

      for (let index = 0; index < validGroupList.length; index++) {
        const pkUserIds = Array.from(pkArr[validGroupList[index]].keys());
        for (let pkindex = 0; pkindex < pkUserIds.length; pkindex++) {
          if (
            !gfl[validGroupList[index]].includes(Number(pkUserIds[pkindex]))
          ) {
            pkArr[validGroupList[index]].delete(String(pkUserIds[pkindex]));
          }
        }
        this.saveJson(pkArr, validGroupList[index]);
      }
    }
    await this.e.reply("已清理完成，正在启动重启操作以使数据生效");
    setTimeout(() => this.restart(), 2000);
  }

  /**
   * 云崽重启操作
   */
  restart() {
    new Restart(this.e).restart();
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

  /** 保存json文件 */
  saveJson(pkArr, group_id) {
    let obj = {};
    for (let [k, v] of pkArr[group_id]) {
      obj[k] = v;
    }

    fs.writeFileSync(
      `${this.pkJsonPath}${group_id}.json`,
      JSON.stringify(obj, "", "\t")
    );
  }
}
