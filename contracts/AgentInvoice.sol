// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title AgentInvoice
/// @notice Non-custodial invoice + receipt registry denominated in Arc's native USDC.
/// Amounts are in native units (msg.value, 18 decimals on Arc: 1 USDC = 1e18).
/// The contract has no owner, no admin, no upgrade path, and never holds funds:
/// payment is forwarded to the payee in the same transaction it is received.
contract AgentInvoice {
    enum Status { None, Active, Paid, Cancelled }

    struct Invoice {
        address payee;
        uint96 paidAt;      // unix seconds, 0 until paid
        uint256 amount;     // native units
        bytes32 metadataHash;
        address payer;      // zero until paid
        Status status;
    }

    mapping(bytes32 => Invoice) private _invoices;

    event InvoiceCreated(bytes32 indexed invoiceId, address indexed payee, uint256 amount, bytes32 metadataHash);
    event InvoicePaid(bytes32 indexed invoiceId, address indexed payee, address indexed payer, uint256 amount, uint256 paidAt);
    event InvoiceCancelled(bytes32 indexed invoiceId, address indexed payee);

    error InvoiceExists();
    error InvoiceNotFound();
    error ZeroAmount();
    error WrongValue(uint256 expected, uint256 sent);
    error NotActive(Status status);
    error NotPayee();
    error TransferFailed();

    function createInvoice(bytes32 invoiceId, uint256 amountNative, bytes32 metadataHash) external {
        if (amountNative == 0) revert ZeroAmount();
        if (_invoices[invoiceId].status != Status.None) revert InvoiceExists();
        _invoices[invoiceId] = Invoice({
            payee: msg.sender,
            paidAt: 0,
            amount: amountNative,
            metadataHash: metadataHash,
            payer: address(0),
            status: Status.Active
        });
        emit InvoiceCreated(invoiceId, msg.sender, amountNative, metadataHash);
    }

    function payInvoice(bytes32 invoiceId) external payable {
        Invoice storage inv = _invoices[invoiceId];
        if (inv.status == Status.None) revert InvoiceNotFound();
        if (inv.status != Status.Active) revert NotActive(inv.status);
        if (msg.value != inv.amount) revert WrongValue(inv.amount, msg.value);

        // effects before interaction
        inv.status = Status.Paid;
        inv.payer = msg.sender;
        inv.paidAt = uint96(block.timestamp);
        address payee = inv.payee;

        (bool ok, ) = payee.call{value: msg.value}("");
        if (!ok) revert TransferFailed(); // reverts all state, incl. Paid flag

        emit InvoicePaid(invoiceId, payee, msg.sender, msg.value, block.timestamp);
    }

    function cancelInvoice(bytes32 invoiceId) external {
        Invoice storage inv = _invoices[invoiceId];
        if (inv.status == Status.None) revert InvoiceNotFound();
        if (inv.payee != msg.sender) revert NotPayee();
        if (inv.status != Status.Active) revert NotActive(inv.status);
        inv.status = Status.Cancelled;
        emit InvoiceCancelled(invoiceId, msg.sender);
    }

    function getInvoice(bytes32 invoiceId) external view returns (Invoice memory) {
        return _invoices[invoiceId];
    }
}
