// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console} from "forge-std/Script.sol";
import {ServiceRegistry} from "../src/ServiceRegistry.sol";
import {NastarEscrow} from "../src/NastarEscrow.sol";
import {MockERC721} from "../test/MockERC721.sol";
import {MockERC20} from "../test/MockERC20.sol";

/**
 * @title SeedDemo
 * @notice Deploys a fully seeded demo environment for Nastar.
 *
 * Creates 4 agents, 4 services, 12 deals (mix of completed/disputed/resolved).
 * Designed for hackathon demos — shows live TrustScores, revenue, leaderboard.
 *
 * Usage:
 *   PRIVATE_KEY=0x... forge script script/SeedDemo.s.sol \
 *     --rpc-url https://forno.celo-sepolia.celo-testnet.org \
 *     --broadcast --legacy
 */
contract SeedDemo is Script {

    // Agent personas
    string constant RESEARCH_BOT   = "ResearchBot";
    string constant TRANSLATE_BOT  = "TranslateBot";
    string constant CODE_REVIEWER  = "CodeReviewer";
    string constant DATA_ANALYST   = "DataAnalyst";

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        console.log("=== Nastar Demo Seed ===");
        console.log("Deployer:", deployer);

        // Deploy + fund with deployer key, then switch to buyer key for deal creation
        vm.startBroadcast(deployerKey);

        // ── Deploy mock infra ─────────────────────────────────────────────
        MockERC721 identity = new MockERC721();
        MockERC20  usdc     = new MockERC20();   // 6 decimals in name only; mock uses 18

        ServiceRegistry registry = new ServiceRegistry(address(identity));
        NastarEscrow    escrow   = new NastarEscrow(
            address(identity),
            address(registry),
            deployer,      // feeRecipient = deployer for demo
            deployer       // judgeAddress = deployer for demo
        );

        // ── Create separate buyer wallet (different address = no SelfDeal) ──
        // Use a deterministic address derived from the deployer key
        address buyerAddr = vm.addr(deployerKey + 1);
        vm.deal(buyerAddr, 1 ether); // fund with CELO for gas

        // ── Mint agent NFTs ───────────────────────────────────────────────
        uint256 agentResearch  = identity.mint(deployer);   // 0 — seller agents
        uint256 agentTranslate = identity.mint(deployer);   // 1
        uint256 agentCode      = identity.mint(deployer);   // 2
        uint256 agentData      = identity.mint(deployer);   // 3
        uint256 agentBuyer     = identity.mint(buyerAddr);  // 4 — buyer (different wallet)

        console.log("Agents minted: 0-4");

        // ── Register services ─────────────────────────────────────────────
        bytes32[] memory tags1 = new bytes32[](2);
        tags1[0] = keccak256("research"); tags1[1] = keccak256("web");
        uint256 sResearch = registry.registerService(
            agentResearch,
            "Web Research & Summary",
            "Deep web research on any topic. Returns structured summary with sources.",
            "https://api-production-a473.up.railway.app/v1/hosted",
            address(usdc), 2e18, tags1
        );

        bytes32[] memory tags2 = new bytes32[](2);
        tags2[0] = keccak256("translation"); tags2[1] = keccak256("language");
        uint256 sTranslate = registry.registerService(
            agentTranslate,
            "Multi-Language Translator",
            "Translate text into 40+ languages with cultural context. Optimized for business docs.",
            "https://api-production-a473.up.railway.app/v1/hosted",
            address(usdc), 1e18, tags2
        );

        bytes32[] memory tags3 = new bytes32[](2);
        tags3[0] = keccak256("code"); tags3[1] = keccak256("solidity");
        uint256 sCode = registry.registerService(
            agentCode,
            "Solidity & JS Code Review",
            "Security-focused code review. Checks for reentrancy, access control, overflow.",
            "https://api-production-a473.up.railway.app/v1/hosted",
            address(usdc), 5e18, tags3
        );

        bytes32[] memory tags4 = new bytes32[](2);
        tags4[0] = keccak256("data"); tags4[1] = keccak256("analytics");
        uint256 sData = registry.registerService(
            agentData,
            "On-Chain Data Analytics",
            "Query and analyze on-chain data. Wallet profiling, DeFi exposure, token flows.",
            "https://api-production-a473.up.railway.app/v1/hosted",
            address(usdc), 3e18, tags4
        );

        console.log("Services registered");

        // ── Fund buyer with USDC + CELO ───────────────────────────────────
        usdc.mint(buyerAddr, 10000e18);
        // Send CELO to buyer for gas (0.3 CELO should cover all txs)
        payable(buyerAddr).transfer(0.3 ether);

        uint256 deadline = block.timestamp + 7 days;

        vm.stopBroadcast(); // end deployer setup broadcast

        // ── Deals: buyer signs createDeal + confirmDelivery / disputeDeal ─
        vm.startBroadcast(deployerKey + 1); // buyer key
        // Approve escrow
        usdc.approve(address(escrow), type(uint256).max);

        uint256 d1  = escrow.createDeal(sResearch,  agentBuyer, agentResearch,  address(usdc), 2e18, "Research Celo ecosystem growth Q1 2026",      deadline, false);
        uint256 d2  = escrow.createDeal(sTranslate, agentBuyer, agentTranslate, address(usdc), 1e18, "Translate whitepaper to Portuguese",           deadline, false);
        uint256 d3  = escrow.createDeal(sCode,      agentBuyer, agentCode,      address(usdc), 5e18, "Review NastarEscrow.sol for security issues",  deadline, false);
        uint256 d4  = escrow.createDeal(sData,      agentBuyer, agentData,      address(usdc), 3e18, "Analyze top 100 Celo wallets DeFi exposure",   deadline, false);
        uint256 d5  = escrow.createDeal(sResearch,  agentBuyer, agentResearch,  address(usdc), 2e18, "Compare Mento vs Uniswap liquidity models",    deadline, false);
        uint256 d6  = escrow.createDeal(sTranslate, agentBuyer, agentTranslate, address(usdc), 1e18, "Translate pitch deck to Spanish",              deadline, false);
        uint256 d7  = escrow.createDeal(sData,      agentBuyer, agentData,      address(usdc), 3e18, "Track MEV activity on Celo last 30 days",      deadline, false);
        uint256 d8  = escrow.createDeal(sCode,      agentBuyer, agentCode,      address(usdc), 5e18, "Audit frontend wallet connection flow",        deadline, false);
        uint256 d9  = escrow.createDeal(sResearch,  agentBuyer, agentResearch,  address(usdc), 2e18, "Map all Celo DeFi protocols by TVL",           deadline, true);
        uint256 d10 = escrow.createDeal(sTranslate, agentBuyer, agentTranslate, address(usdc), 1e18, "Translate legal contract to French",           deadline, false);
        uint256 d11 = escrow.createDeal(sData,      agentBuyer, agentData,      address(usdc), 3e18, "Build wallet scoring model for Celo addresses",deadline, false);
        uint256 d12 = escrow.createDeal(sCode,      agentBuyer, agentCode,      address(usdc), 5e18, "Review smart contract upgrade pattern",        deadline, false);
        vm.stopBroadcast();

        // ── Sellers accept + deliver ───────────────────────────────────────
        vm.startBroadcast(deployerKey);

        // Accept all
        for (uint256 i = d1; i <= d12; i++) escrow.acceptDeal(i);

        // Deliver deals 1-11
        escrow.deliverDeal(d1,  "ipfs://QmResearch1Result");
        escrow.deliverDeal(d2,  "ipfs://QmTranslate1Result");
        escrow.deliverDeal(d3,  "ipfs://QmCodeReview1Result");
        escrow.deliverDeal(d4,  "ipfs://QmData1Result");
        escrow.deliverDeal(d5,  "ipfs://QmResearch2Result");
        escrow.deliverDeal(d6,  "ipfs://QmTranslate2Result");
        escrow.deliverDeal(d7,  "ipfs://QmData2Result");
        escrow.deliverDeal(d8,  "ipfs://QmCode2Result");
        escrow.deliverDeal(d9,  "ipfs://QmResearch3Auto"); // autoConfirm — pays immediately
        escrow.deliverDeal(d10, "ipfs://QmTranslate3Partial");
        // d11: accepted but not delivered yet (shows "Accepted")
        // d12: accepted not delivered yet

        vm.stopBroadcast();

        // ── Buyer confirms d1-d8 ──────────────────────────────────────────
        vm.startBroadcast(deployerKey + 1);
        escrow.confirmDelivery(d1);
        escrow.confirmDelivery(d2);
        escrow.confirmDelivery(d3);
        escrow.confirmDelivery(d4);
        escrow.confirmDelivery(d5);
        escrow.confirmDelivery(d6);
        escrow.confirmDelivery(d7);
        escrow.confirmDelivery(d8);
        // d9 already auto-confirmed
        escrow.disputeDeal(d10); // buyer disputes
        vm.stopBroadcast();

        // ── AI judge resolves d10 ─────────────────────────────────────────
        vm.startBroadcast(deployerKey);
        escrow.resolveDisputeWithJudge(
            d10, 7000,
            "Delivery partially matches requirements. 3 of 5 clauses translated correctly. Seller awarded 70%."
        );
        vm.stopBroadcast();

        console.log("\n=== DEMO CONTRACT ADDRESSES ===");
        console.log("MockIdentity:    ", address(identity));
        console.log("MockUSDC:        ", address(usdc));
        console.log("ServiceRegistry: ", address(registry));
        console.log("NastarEscrow:    ", address(escrow));
        console.log("\n=== AGENT NFT IDs ===");
        console.log("ResearchBot:     ", agentResearch);
        console.log("TranslateBot:    ", agentTranslate);
        console.log("CodeReviewer:    ", agentCode);
        console.log("DataAnalyst:     ", agentData);
        console.log("\n=== DEALS ===");
        console.log("Completed: 9 deals");
        console.log("AI-Resolved dispute: 1 deal");
        console.log("In Progress: 2 deals");
        console.log("\n=== STATS ===");
        // Protocol revenue: 20% of each deal
        uint256 total = 2e18 + 1e18 + 5e18 + 3e18 + 2e18 + 1e18 + 3e18 + 5e18 + 2e18 + 1e18;
        uint256 fee = total * 2000 / 10000;
        console.log("Total volume: (see output)");
        console.log("Protocol revenue: (see output)");
    }
}
