import plugin from "../../../lib/plugins/plugin.js";
import lodash from "lodash";
import fs from "node:fs";

export class ability extends plugin {
  constructor() {
    super({
      name: "功能相关",
      dsc: "处理功能相关代码",
      event: "message",
      priority: 50000000,
      rule: [
        {
          reg: "^#.*$",
          fnc: "lenovo",
        },
      ],
    });
  }

  async lenovo() {
    const e = this.e;
    const rules = await this.getRules(e);

    let lenovoRules = [];

    if (rules && rules.length) {
      for (let r of rules) {
        // const regArr = r.reg.match(/[\u4e00-\u9fa5]/g);

        // const regzm = r.reg.replaceAll(/[\u4e00-\u9fa5]/g, "").trim();

        // const zm = e.msg
        //   .replace("#", "")
        //   .replaceAll(/[\u4e00-\u9fa5]/g, "")
        //   .trim();
        // const msgArr = e.msg.replace("#", "").match(/[\u4e00-\u9fa5]/g);
        // if (zm) {
        //   msgArr.push(zm);
        // }
        // if (regzm) {
        //   regArr.push(regzm);
        // }
        const regArr = Array.from(new Set(r.reg.split("")));
        const msgArr = Array.from(new Set(e.msg.replace("#", "").split("")));
        const mixArr = lodash.intersection(regArr, msgArr).length;
        if (mixArr) {
          lenovoRules.push({ reg: r.reg, name: r.plugin, count: mixArr });
        }
      }
    }

    const messages = [`【${e.msg}】没有找到此功能哦，您是否要使用：\n`];

    if (lenovoRules && lenovoRules.length) {
      const filterLenovoRules = lenovoRules.filter((item) => item.count > 1);

      if (filterLenovoRules.length) {
        lenovoRules = filterLenovoRules.sort((a, b) => {
          return b.count - a.count;
        });
        const maxLenovoRules = lenovoRules.filter(
          (item) => item.count === lenovoRules[0].count
        );
        lenovoRules = lenovoRules.slice(0, maxLenovoRules.length + 2);
      }
      for (let l of lenovoRules) {
        messages.push(`${l.reg}【${l.name}】\n`);
      }

      if (messages.length > 4) {
        await this.e.reply(
          await Bot.makeForwardMsg([
            {
              message: messages[0].replace("\n", ""),
              nickname: Bot.nickname,
              user_id: Bot.uin,
            },
            {
              message: messages.slice(1).join(""),
              nickname: Bot.nickname,
              user_id: Bot.uin,
            },
          ])
        );
      } else {
        await this.e.reply(messages);
      }
    }
  }

  async getRules(e) {
    const files = this.getPlugins();

    const rules = [];

    for (let File of files) {
      try {
        let tmp = await import(File.path);
        if (tmp.apps) tmp = { ...tmp.apps };
        lodash.forEach(tmp, (p, i) => {
          if (!p.prototype) {
            return;
          }
          /* eslint-disable new-cap */
          let plugin = new p();

          if (plugin.rule) {
            b: for (let v of plugin.rule) {
              /** 判断事件 */
              if (v.event && !this.filtEvent(e, v)) continue b;

              /** 判断权限 */
              if (!this.filtPermission(e, v)) break b;

              if (/[\u4e00-\u9fa5]/g.test(v.reg)) {
                rules.push({
                  plugin: plugin.name || undefined,
                  reg: v.reg.replace(/(\^|\$)/g, ""),
                });
              }

              // if (new RegExp(v.reg).test(e.msg)) {

              //   console.log(v.reg);
              //   console.log(e.msg);
              //   existRule = true;
              // }
            }
          }
        });
      } catch (error) {
        logger.error(decodeURI(error.stack));
      }
    }
    return rules;
  }

  getPlugins() {
    let ignore = ["index.js", "guoba.support.js"];
    let files = fs.readdirSync("./plugins", { withFileTypes: true });
    let ret = [];
    for (let val of files) {
      let filepath = "../../" + val.name;
      let tmp = {
        name: val.name,
      };
      if (val.isFile()) {
        if (!val.name.endsWith(".js")) continue;
        if (ignore.includes(val.name)) continue;
        tmp.path = filepath;
        ret.push(tmp);
        continue;
      }

      if (fs.existsSync(`./plugins/${val.name}/index.js`)) {
        tmp.path = filepath + "/index.js";
        ret.push(tmp);
        continue;
      }

      let apps = fs.readdirSync(`./plugins/${val.name}`, {
        withFileTypes: true,
      });
      for (let app of apps) {
        if (!app.name.endsWith(".js")) continue;
        if (ignore.includes(app.name)) continue;

        ret.push({
          name: `${val.name}/${app.name}`,
          path: `../../${val.name}/${app.name}`,
        });

        continue;
      }
    }

    return ret;
  }

  /** 过滤事件 */
  filtEvent(e, v) {
    let event = v.event.split(".");
    let eventMap = {
      message: ["post_type", "message_type", "sub_type"],
      notice: ["post_type", "notice_type", "sub_type"],
      request: ["post_type", "request_type", "sub_type"],
    };
    let newEvent = [];
    event.forEach((val, index) => {
      if (val === "*") {
        newEvent.push(val);
      } else if (eventMap[e.post_type]) {
        newEvent.push(e[eventMap[e.post_type][index]]);
      }
    });
    newEvent = newEvent.join(".");

    if (v.event == newEvent) return true;

    return false;
  }

  /** 判断权限 */
  filtPermission(e, v) {
    if (v.permission == "all" || !v.permission) return true;

    if (v.permission == "master") {
      if (e.isMaster) {
        return true;
      } else {
        // e.reply("暂无权限，只有主人才能操作");
        return false;
      }
    }

    if (e.isGroup) {
      if (!e.member?._info) {
        // e.reply("数据加载中，请稍后再试");
        return false;
      }
      if (v.permission == "owner") {
        if (!e.member.is_owner) {
          // e.reply("暂无权限，只有群主才能操作");
          return false;
        }
      }
      if (v.permission == "admin") {
        if (!e.member.is_admin) {
          // e.reply("暂无权限，只有管理员才能操作");
          return false;
        }
      }
    }

    return true;
  }
}
