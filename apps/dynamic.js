import { segment } from "oicq";
import lodash from "lodash";
import plugin from "../../../lib/plugins/plugin.js";
import axios from "axios";

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

    let response = await axios.get(`https://ovooa.com/API/pai/?msg=${msg}`, {
      timeout: 20000,
      responseType: "arraybuffer",
    });

    this.reply(
      segment.image(
        "base64://" +
          btoa(
            new Uint8Array(response.data).reduce(
              (data, byte) => data + String.fromCharCode(byte),
              ""
            )
          )
      )
    );
  }
}
