var Pixie = artifacts.require("Pixie.sol");

module.exports = async function(deployer) {
  await deployer.deploy(Pixie);

  console.log("Initializing columns");
  const pixie = await Pixie.deployed();
  const numColumns = (await pixie.getNumColumns()).toNumber();
  const promises = [];
  for(var i = 0; i < numColumns; i++) {
    const promise = pixie.initializeColumn(i, 0xffffff);
    promises.push(promise);
  }
  await Promise.all(promises);
  await pixie.finishInitialization();
  console.log("Initialization complete");
};