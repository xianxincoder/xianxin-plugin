import moment from "moment";
import lodash from "lodash";
import base from "./base.js";

export default class Birthday extends base {
  constructor(e) {
    super(e);
    this.model = "birthday";
  }

  /** 生成角色生日图片 */
  async getData(groupId, roleName, content) {
    let data = {
      ...this.screenData,
      userId: groupId,
      quality: 90,
      roleName,
      content,
      saveId: groupId,
    };
    return data;
  }
}
