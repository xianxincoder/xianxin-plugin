import base from "./base.js";

export default class Glgg extends base {
  constructor(e) {
    super(e);
    this.model = "glgg";
  }

  async getGlggData(glggData) {
    return {
      ...this.screenData,
      saveId: "glgg",
      ...glggData,
    };
  }
}
