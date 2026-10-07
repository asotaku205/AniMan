import { AppController } from "./app.controller.js";

describe("AppController", () => {
  it("returns the health-check greeting", () => {
    expect(new AppController().getHello()).toBe("Hello, World!");
  });
});
