import plugin from "../../../lib/plugins/plugin.js";

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
}
