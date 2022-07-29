import { segment } from "oicq";
import lodash from "lodash";
import plugin from "../../../lib/plugins/plugin.js";
import fetch from "node-fetch";

export class dynamic extends plugin {
  constructor() {
    super({
      name: "动态图片|头像",
      dsc: "动态图片表情",
      event: "message",
      priority: 400,
      rule: [
        {
          reg: "^举牌.*$",
          fnc: "raiseCard",
        },
      ],
    });
  }

  async raiseCard() {
    let msg = encodeURI(this.e.msg.replace(/举牌/g, ""));

    let response = await fetch(`https://ovooa.com/API/pai/?msg=${msg}`, {
      method: "get",
      responseType: "arraybuffer",
    });

    const buffer = await response.arrayBuffer();

    this.reply(
      segment.image(
        "base64://" +
          btoa(
            new Uint8Array(buffer).reduce(
              (data, byte) => data + String.fromCharCode(byte),
              ""
            )
          )
      )
    );
  }
}
