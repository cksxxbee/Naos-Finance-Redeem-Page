import { parseAbi } from 'viem';

// ─── BSC BoostPool ───
export const BOOST_POOL_ADDRESS = '0x3Dcd32Dd2b225749Aa830Ca3B4F2411BFEB03DB4';

export const boostPoolAbi = parseAbi([
  "function rewardRate() external view returns (uint256)",
  "function getPoolTotalDeposited() external view returns (uint256)",
  "function getStakeTotalDeposited(address _account) external view returns (uint256)",
  "function getStakeTotalUnclaimedImmediately(address _account) external view returns (uint256)",
  "function getStakeTotalUnclaimed(address _account) external view returns (uint256)",
  "function getUserClaimPeriod(address _account) external view returns (uint256 claimStart, uint256 claimEnd)",
  "function getLockTimeWeightedListLength() external view returns (uint256)",
  "function getLockTimeWeightedByIndex(uint256 _index) external view returns (uint256 lockTime, uint256 weighted)",
  "function getUserOrderCount(address _account) external view returns (uint256 count)",
  "function getUserDepositOrderByIndex(address _account, uint256 _index) external view returns (uint256 amount, uint256 expiredTime, uint256 weighted, bool isWithdraw)",
  "function deposit(uint256 _depositAmount, uint256 _index) external",
  "function withdraw(uint256[] calldata _index) external",
  "function claimImmediately() external",
  "function claim() external",
  "function startCoolDown() external",
  "function penaltyPercent() external view returns (uint256)",
  "function cooldownPeriod() external view returns (uint256)",
  "function getPoolToken() external view returns (address)",
  "function getPoolTotalDepositedWeight() external view returns (uint256)",
  "function getStakeTotalDepositedWeight(address _account) external view returns (uint256)",
  "function reward() external view returns (address)"
]);

// ─── ETH StakingPools ───
export const STAKING_POOLS_ADDRESS = '0x99E4eA9eF6bf396C49B35FF9478EbB8890aEF581';

export const stakingPoolsAbi = parseAbi([
  "function rewardRate() external view returns (uint256)",
  "function totalRewardWeight() external view returns (uint256)",
  "function poolCount() external view returns (uint256)",
  "function getPoolToken(uint256 _poolId) external view returns (address)",
  "function getPoolTotalDeposited(uint256 _poolId) external view returns (uint256)",
  "function getPoolRewardWeight(uint256 _poolId) external view returns (uint256)",
  "function getPoolRewardRate(uint256 _poolId) external view returns (uint256)",
  "function getStakeTotalDeposited(address _account, uint256 _poolId) external view returns (uint256)",
  "function getStakeTotalUnclaimed(address _account, uint256 _poolId) external view returns (uint256)",
  "function deposit(uint256 _poolId, uint256 _depositAmount) external",
  "function withdraw(uint256 _poolId, uint256 _withdrawAmount) external",
  "function claim(uint256 _poolId) external",
  "function exit(uint256 _poolId) external",
  "function reward() external view returns (address)",
  "function governance() external view returns (address)",
  "function tokenPoolIds(address) external view returns (uint256)"
]);

// ─── Standard ERC20 ───
export const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
]);
