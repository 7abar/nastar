// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console} from "forge-std/Script.sol";
import {ServiceRegistry} from "../src/ServiceRegistry.sol";
import {NastarEscrow} from "../src/NastarEscrow.sol";

contract DeployNastar is Script {
    // ERC-8004 Identity Registry on Celo Sepolia
    address constant IDENTITY_REGISTRY_SEPOLIA = 0x8004A818BFB912233c491871b3d84c89A494BD9e;

    // ERC-8004 Identity Registry on Celo Mainnet
    address constant IDENTITY_REGISTRY_MAINNET = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        bool isMainnet = vm.envOr("MAINNET", false);

        address identityRegistry = isMainnet
            ? IDENTITY_REGISTRY_MAINNET
            : IDENTITY_REGISTRY_SEPOLIA;

        vm.startBroadcast(deployerKey);

        // Deploy ServiceRegistry
        ServiceRegistry registry = new ServiceRegistry(identityRegistry);
        console.log("ServiceRegistry deployed at:", address(registry));

        // Deploy NastarEscrow
        NastarEscrow escrow = new NastarEscrow(identityRegistry, address(registry));
        console.log("NastarEscrow deployed at:", address(escrow));

        vm.stopBroadcast();

        console.log("---");
        console.log("Identity Registry (ERC-8004):", identityRegistry);
        console.log("Network:", isMainnet ? "Celo Mainnet" : "Celo Sepolia");
    }
}
