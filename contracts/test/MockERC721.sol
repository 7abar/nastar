// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @notice Minimal ERC-721 mock for testing (simulates ERC-8004 Identity Registry)
 */
contract MockERC721 {
    mapping(uint256 => address) private _owners;
    uint256 public nextTokenId;

    function mint(address to) external returns (uint256 tokenId) {
        tokenId = nextTokenId++;
        _owners[tokenId] = to;
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "ERC721: nonexistent token");
        return owner;
    }

    // Minimal interface stubs
    function balanceOf(address) external pure returns (uint256) { return 0; }
    function approve(address, uint256) external {}
    function getApproved(uint256) external pure returns (address) { return address(0); }
    function setApprovalForAll(address, bool) external {}
    function isApprovedForAll(address, address) external pure returns (bool) { return false; }
    function transferFrom(address, address, uint256) external {}
    function safeTransferFrom(address, address, uint256) external {}
    function safeTransferFrom(address, address, uint256, bytes calldata) external {}
    function supportsInterface(bytes4) external pure returns (bool) { return true; }
}
