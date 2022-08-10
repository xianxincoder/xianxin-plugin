import base from "./base.js";

export default class Gobang extends base {
  constructor(e) {
    super(e);
    this.model = "gobang";
  }

  async getGobangData(gobangData) {
    return {
      ...this.screenData,
      saveId: "gobang",
      ...gobangData,
    };
  }
}
