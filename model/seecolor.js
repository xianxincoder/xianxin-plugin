import base from "./base.js";

export default class Seecolor extends base {
  constructor(e) {
    super(e);
    this.model = "seecolor";
  }

  async getSeecolorData(seecolorData) {
    return {
      ...this.screenData,
      saveId: "seecolor",
      ...seecolorData,
    };
  }
}
