const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const ID = ethers.id("inv-1");
const META = ethers.id("ipfs://meta");
const AMT = ethers.parseEther("1.5"); // 1.5 native USDC

describe("AgentInvoice", () => {
  let c, payee, payer, other;
  beforeEach(async () => {
    [payee, payer, other] = await ethers.getSigners();
    c = await (await ethers.getContractFactory("AgentInvoice")).deploy();
  });

  it("creates and reads back an invoice + event", async () => {
    await expect(c.connect(payee).createInvoice(ID, AMT, META))
      .to.emit(c, "InvoiceCreated").withArgs(ID, payee.address, AMT, META);
    const i = await c.getInvoice(ID);
    expect(i.payee).to.equal(payee.address);
    expect(i.amount).to.equal(AMT);
    expect(i.metadataHash).to.equal(META);
    expect(i.status).to.equal(1n);
    expect(i.payer).to.equal(ethers.ZeroAddress);
  });
  it("unknown id reads as None", async () => {
    expect((await c.getInvoice(ID)).status).to.equal(0n);
  });
  it("rejects duplicate id (even from another account)", async () => {
    await c.createInvoice(ID, AMT, META);
    await expect(c.createInvoice(ID, AMT, META)).to.be.revertedWithCustomError(c, "InvoiceExists");
    await expect(c.connect(other).createInvoice(ID, 1, META)).to.be.revertedWithCustomError(c, "InvoiceExists");
  });
  it("rejects zero amount", async () => {
    await expect(c.createInvoice(ID, 0, META)).to.be.revertedWithCustomError(c, "ZeroAmount");
  });

  it("pays: forwards exact value, records payer/time, emits receipt, holds nothing", async () => {
    await c.connect(payee).createInvoice(ID, AMT, META);
    const before = await ethers.provider.getBalance(payee.address);
    const tx = await c.connect(payer).payInvoice(ID, { value: AMT });
    const rc = await tx.wait();
    const ts = (await ethers.provider.getBlock(rc.blockNumber)).timestamp;
    await expect(tx).to.emit(c, "InvoicePaid").withArgs(ID, payee.address, payer.address, AMT, ts);
    expect(await ethers.provider.getBalance(payee.address)).to.equal(before + AMT);
    expect(await ethers.provider.getBalance(await c.getAddress())).to.equal(0n);
    const i = await c.getInvoice(ID);
    expect(i.status).to.equal(2n);
    expect(i.payer).to.equal(payer.address);
    expect(i.paidAt).to.equal(BigInt(ts));
  });
  it("rejects wrong value (under/over) and unknown id", async () => {
    await c.createInvoice(ID, AMT, META);
    await expect(c.connect(payer).payInvoice(ID, { value: AMT - 1n })).to.be.revertedWithCustomError(c, "WrongValue");
    await expect(c.connect(payer).payInvoice(ID, { value: AMT + 1n })).to.be.revertedWithCustomError(c, "WrongValue");
    await expect(c.connect(payer).payInvoice(ID, { value: 0 })).to.be.revertedWithCustomError(c, "WrongValue");
    await expect(c.connect(payer).payInvoice(ethers.id("nope"), { value: AMT })).to.be.revertedWithCustomError(c, "InvoiceNotFound");
  });
  it("rejects double pay", async () => {
    await c.createInvoice(ID, AMT, META);
    await c.connect(payer).payInvoice(ID, { value: AMT });
    await expect(c.connect(other).payInvoice(ID, { value: AMT })).to.be.revertedWithCustomError(c, "NotActive").withArgs(2);
  });
  it("payee can pay own invoice (no special casing)", async () => {
    await c.createInvoice(ID, AMT, META);
    await c.payInvoice(ID, { value: AMT });
    expect((await c.getInvoice(ID)).status).to.equal(2n);
  });

  it("cancel: payee only, before paid; blocks payment; no re-create", async () => {
    await c.createInvoice(ID, AMT, META);
    await expect(c.connect(other).cancelInvoice(ID)).to.be.revertedWithCustomError(c, "NotPayee");
    await expect(c.cancelInvoice(ID)).to.emit(c, "InvoiceCancelled").withArgs(ID, payee.address);
    expect((await c.getInvoice(ID)).status).to.equal(3n);
    await expect(c.connect(payer).payInvoice(ID, { value: AMT })).to.be.revertedWithCustomError(c, "NotActive").withArgs(3);
    await expect(c.cancelInvoice(ID)).to.be.revertedWithCustomError(c, "NotActive");
    await expect(c.createInvoice(ID, AMT, META)).to.be.revertedWithCustomError(c, "InvoiceExists");
  });
  it("cancel after pay reverts", async () => {
    await c.createInvoice(ID, AMT, META);
    await c.connect(payer).payInvoice(ID, { value: AMT });
    await expect(c.cancelInvoice(ID)).to.be.revertedWithCustomError(c, "NotActive").withArgs(2);
  });
  it("cancel unknown id reverts", async () => {
    await expect(c.cancelInvoice(ID)).to.be.revertedWithCustomError(c, "InvoiceNotFound");
  });

  it("payee that rejects funds: payment reverts, invoice stays Active, no funds stuck", async () => {
    const r = await (await ethers.getContractFactory("RejectingPayee")).deploy();
    await r.create(await c.getAddress(), ID, AMT);
    await expect(c.connect(payer).payInvoice(ID, { value: AMT })).to.be.revertedWithCustomError(c, "TransferFailed");
    const i = await c.getInvoice(ID);
    expect(i.status).to.equal(1n);
    expect(i.payer).to.equal(ethers.ZeroAddress);
    expect(await ethers.provider.getBalance(await c.getAddress())).to.equal(0n);
  });
  it("reentrant payee cannot double-pay", async () => {
    const r = await (await ethers.getContractFactory("ReentrantPayee")).deploy();
    await r.create(await c.getAddress(), ID, AMT);
    await c.connect(payer).payInvoice(ID, { value: AMT });
    expect(await r.reentered()).to.equal(true);
    expect(await r.reentryBlocked()).to.equal(true);
    expect((await c.getInvoice(ID)).status).to.equal(2n);
    expect(await ethers.provider.getBalance(await c.getAddress())).to.equal(0n);
  });
  it("plain native transfers to the contract are rejected (no receive/fallback)", async () => {
    await expect(payer.sendTransaction({ to: await c.getAddress(), value: 1 })).to.be.reverted;
  });
  it("paidAt follows block time", async () => {
    await c.createInvoice(ID, AMT, META);
    await time.increase(1000);
    await c.connect(payer).payInvoice(ID, { value: AMT });
    expect((await c.getInvoice(ID)).paidAt).to.be.gt(0n);
  });
});
