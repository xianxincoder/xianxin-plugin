import { segment } from "oicq";
import plugin from "../../../lib/plugins/plugin.js";

export class chat extends plugin {
  constructor() {
    super({
      name: "杂项",
      dsc: "处理一些杂项",
      event: "message",
      priority: 5000,
      rule: [
        {
          reg: "^#赞我$",
          fnc: "thumbsUpMe",
        },
      ],
    });
  }

  async thumbsUpMe() {
    Bot.pickFriend(this.e.user_id).thumbUp(10);
    this.reply("已给你点赞");
  }
}
