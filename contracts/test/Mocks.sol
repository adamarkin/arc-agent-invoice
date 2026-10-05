// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "../AgentInvoice.sol";

contract RejectingPayee {
    function create(AgentInvoice c, bytes32 id, uint256 amt) external { c.createInvoice(id, amt, bytes32(0)); }
    receive() external payable { revert("no"); }
}

contract ReentrantPayee {
    AgentInvoice public c;
    bytes32 public id;
    bool public reentered;
    bool public reentryBlocked;
    function create(AgentInvoice _c, bytes32 _id, uint256 amt) external { c = _c; id = _id; c.createInvoice(_id, amt, bytes32(0)); }
    receive() external payable {
        reentered = true;
        try c.payInvoice{value: msg.value}(id) {} catch { reentryBlocked = true; }
    }
}
