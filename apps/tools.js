import plugin from "../../../lib/plugins/plugin.js";
import common from "../../../lib/common/common.js";
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
          reg: "^#*潜水\\s*[0-9]*$",
          fnc: "lurk",
          permission: "master",
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
    let days = this.e.msg.replace(/#*潜水\s*/g, "").trim() || 0;

    let gl = await this.e.group.getMemberMap();

    let msg = [];

    for (let [k, v] of gl) {
      if (days == 0) {
        if (v.last_sent_time == v.join_time) {
          //计算相差多少天
          let diffDay = moment().diff(moment.unix(v.join_time), "day");
          msg.push(
            `${v.nickname}(${v.user_id}) 入群${diffDay}天，一直在潜水。`
          );
        }
      } else {
        //计算相差多少天
        let diffDay = moment().diff(moment.unix(v.last_sent_time), "day");
        if (diffDay >= days) {
          msg.push(
            `${v.nickname}(${v.user_id}) 已潜水${diffDay}天了，该出来冒个泡啦！`
          );
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
  }
}
