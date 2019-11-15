const PixieContract = artifacts.require("./Pixie.sol");

contract("Pixie", accounts => {
  let pixie;

  beforeEach(async () => {
    pixie = await PixieContract.new();
  })

  it("has initial values of 0", async () => {
    const c = await pixie.getColor(0, 0);
    assert.equal(c, 0xffffff);
  });

  it("writes a color", async () => {
    await pixie.setColor(0, 0, 0xff0000, {from: accounts[0]});
    const c = await pixie.getColor(0, 0);
    
    assert.equal(c, 0xff0000);
  });

  it("returns all colors", async () => {
    const c = await pixie.getAllColors();

    assert.equal(c.length, 256);
    assert.equal(c[0], 0xffffff);
  });
});