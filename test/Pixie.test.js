const PixieContract = artifacts.require("./Pixie.sol");

const expectThrow = async promise => {
  try {
    await promise;
  } catch (error) {
    // TODO: Check jump destination to destinguish between a throw
    //       and an actual invalid jump.
    const invalidJump = error.message.search('invalid JUMP') >= 0;
    // TODO: When we contract A calls contract B, and B throws, instead
    //       of an 'invalid jump', we get an 'out of gas' error. How do
    //       we distinguish this from an actual out of gas event? (The
    //       testrpc log actually show an 'invalid jump' event.)
    const outOfGas = error.message.search('out of gas') >= 0;
    const exited = error.message.search('exited with an error') >= 0;
    const exceptionWhileProcessing = error.message.search('VM Exception while processing') >= 0;
    assert(
      invalidJump || outOfGas || exited || exceptionWhileProcessing,
      "Expected throw, got '" + error + "' instead",
    );
    return;
  }
  assert.fail('Expected throw not received');
};

contract("Pixie", accounts => {
  let pixie;
  const DEFAULT_COLOR = 0xfcfcfc;

  beforeEach(async () => {
    pixie = await PixieContract.new();
  })

  it("has initial values of 0", async () => {
    assert.equal(await pixie.getColor(0, 0), DEFAULT_COLOR);
  });

  it("writes a color", async () => {
    await pixie.setColor(0, 0, 0xff0000, {from: accounts[0]});
    assert.equal(await pixie.getColor(0, 0), 0xff0000);
  });

  it("returns all colors", async () => {
    const c = await pixie.getAllColors();
    assert.equal(c.length, 256);
    assert.equal(c[0], DEFAULT_COLOR);
  });

  it("gives the owner access initially", async () => {
    assert.isTrue(await pixie.hasAccess(accounts[0]));
  });

  it("does not give a random account access initially or let them paint without access", async () => {
    assert.isFalse(await pixie.hasAccess(accounts[1]));
    assert.equal(await pixie.getColor(0, 0), DEFAULT_COLOR);
    await expectThrow(
      pixie.setColor(0, 0, 0xcc00cc, {from: accounts[1]})
    );
    assert.equal(await pixie.getColor(0, 0), DEFAULT_COLOR);
  });

  it("allows the owner to grants an account access, allowing painting, and allows the owner to revoke access, denying painting", async () => {
    // Precondition
    assert.isFalse(await pixie.hasAccess(accounts[1]));

    // Give an account access
    await pixie.grantAccess(accounts[1], {from: accounts[0]});
    
    // Test that the account can paint
    assert.isTrue(await pixie.hasAccess(accounts[1]));
    assert.equal(await pixie.getColor(0, 0), DEFAULT_COLOR);
    await pixie.setColor(0, 0, 0xdd00dd, {from: accounts[1]});
    assert.equal(await pixie.getColor(0, 0), 0xdd00dd);

    // Revoke access
    await pixie.revokeAccess(accounts[1], {from: accounts[0]});

    // Test that the account can no longer paint
    assert.isFalse(await pixie.hasAccess(accounts[1]));
    await expectThrow(
      pixie.setColor(0, 0, 0xee00ee, {from: accounts[1]})
    );
    assert.equal(await pixie.getColor(0, 0), 0xdd00dd);
  });

  it("only allows painting when active", async () => {
    // Preconditions
    assert.isTrue(await pixie.active());
    assert.equal(await pixie.getColor(0, 0), DEFAULT_COLOR);

    // Test that we can paint when active
    await pixie.setColor(0, 0, 0xbb00bb, {from: accounts[0]});
    assert.equal(await pixie.getColor(0, 0), 0xbb00bb);

    // Pause
    await pixie.pause({from: accounts[0]});
    assert.isFalse(await pixie.active());

    // Test that we can't paint when not active
    await expectThrow(
      pixie.setColor(0, 0, 0xff0000, {from: accounts[0]})
    );
    assert.equal(await pixie.getColor(0, 0), 0xbb00bb);

    // Resume
    await pixie.resume({from: accounts[0]});
    assert.isTrue(await pixie.active());

    // Test that we can paint again
    await pixie.setColor(0, 0, 0x990000, {from: accounts[0]});
    assert.equal(await pixie.getColor(0, 0), 0x990000);
  });
});