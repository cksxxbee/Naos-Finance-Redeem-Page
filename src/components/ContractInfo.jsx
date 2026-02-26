import { useAccount, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { boostPoolAbi, erc20Abi, BOOST_POOL_ADDRESS } from '../abi/contracts';
import { Activity, Clock, Layers, TrendingUp, Percent, Vault } from 'lucide-react';

const CONTRACT_ADDRESS = BOOST_POOL_ADDRESS;

// BSC: ~3 second block time → ~10,512,000 blocks/year
const BLOCKS_PER_YEAR = 10_512_000;

export default function ContractInfo() {
    const { address } = useAccount();

    const { data: poolTokenAddress } = useReadContract({
        address: CONTRACT_ADDRESS, abi: boostPoolAbi, functionName: 'getPoolToken',
        query: { refetchInterval: 30000 },
    });

    const { data: rewardRate } = useReadContract({
        address: CONTRACT_ADDRESS, abi: boostPoolAbi, functionName: 'rewardRate',
        query: { refetchInterval: 30000 },
    });

    const { data: totalDeposited } = useReadContract({
        address: CONTRACT_ADDRESS, abi: boostPoolAbi, functionName: 'getPoolTotalDeposited',
        query: { refetchInterval: 10000 },
    });

    const { data: totalDepositedWeight } = useReadContract({
        address: CONTRACT_ADDRESS, abi: boostPoolAbi, functionName: 'getPoolTotalDepositedWeight',
        query: { refetchInterval: 10000 },
    });

    const { data: penaltyPercent } = useReadContract({
        address: CONTRACT_ADDRESS, abi: boostPoolAbi, functionName: 'penaltyPercent',
    });

    // Reward token address
    const { data: rewardTokenAddress } = useReadContract({
        address: CONTRACT_ADDRESS, abi: boostPoolAbi, functionName: 'reward',
    });

    // Reward token balance held by the contract
    const { data: rewardTokenBalance } = useReadContract({
        address: rewardTokenAddress ?? undefined, abi: erc20Abi, functionName: 'balanceOf',
        args: [CONTRACT_ADDRESS], query: { enabled: !!rewardTokenAddress, refetchInterval: 15000 },
    });

    // Reward token symbol (if different from pool token)
    const { data: rewardTokenSymbol } = useReadContract({
        address: rewardTokenAddress ?? undefined, abi: erc20Abi, functionName: 'symbol',
        query: { enabled: !!rewardTokenAddress },
    });

    const { data: rewardTokenDecimals } = useReadContract({
        address: rewardTokenAddress ?? undefined, abi: erc20Abi, functionName: 'decimals',
        query: { enabled: !!rewardTokenAddress },
    });

    // User specific
    const { data: userDeposited } = useReadContract({
        address: CONTRACT_ADDRESS, abi: boostPoolAbi, functionName: 'getStakeTotalDeposited',
        args: [address], query: { enabled: !!address, refetchInterval: 10000 },
    });

    const { data: userDepositedWeight } = useReadContract({
        address: CONTRACT_ADDRESS, abi: boostPoolAbi, functionName: 'getStakeTotalDepositedWeight',
        args: [address], query: { enabled: !!address, refetchInterval: 10000 },
    });

    // Token info
    const { data: tokenDecimals } = useReadContract({
        address: poolTokenAddress ?? undefined, abi: erc20Abi, functionName: 'decimals',
        query: { enabled: !!poolTokenAddress },
    });

    const { data: tokenSymbol } = useReadContract({
        address: poolTokenAddress ?? undefined, abi: erc20Abi, functionName: 'symbol',
        query: { enabled: !!poolTokenAddress },
    });

    const decimals = tokenDecimals ?? 18;
    const rwdDecimals = rewardTokenDecimals ?? 18;
    const rwdSymbol = rewardTokenSymbol || 'RWD';
    const isSameToken = rewardTokenAddress && poolTokenAddress && rewardTokenAddress.toLowerCase() === poolTokenAddress.toLowerCase();

    // Remaining rewards = reward token balance - totalDeposited (if same token)
    let remainingRewards = null;
    if (rewardTokenBalance != null) {
        if (isSameToken && totalDeposited != null) {
            const remaining = rewardTokenBalance > totalDeposited ? rewardTokenBalance - totalDeposited : 0n;
            remainingRewards = Number(formatUnits(remaining, rwdDecimals));
        } else {
            remainingRewards = Number(formatUnits(rewardTokenBalance, rwdDecimals));
        }
    }

    const formattedTVL = totalDeposited != null
        ? Number(formatUnits(totalDeposited, decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 })
        : '—';

    const formattedRewardRate = rewardRate != null
        ? Number(formatUnits(rewardRate, decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 })
        : '—';

    // ─── APR Calculation ───
    // APR = (rewardRate * blocksPerYear * userWeight / totalPoolWeight) / userDeposited * 100
    let userApr = null;
    let poolAvgApr = null;

    if (rewardRate != null && totalDepositedWeight != null && totalDepositedWeight > 0n && totalDeposited != null && totalDeposited > 0n) {
        // Pool average APR (assumes weight = 1x for simplicity)
        const rewardsPerYearRaw = Number(formatUnits(rewardRate, decimals)) * BLOCKS_PER_YEAR;
        const tvl = Number(formatUnits(totalDeposited, decimals));
        if (tvl > 0) {
            poolAvgApr = (rewardsPerYearRaw / tvl) * 100;
        }

        // User personal APR (accounts for their actual weight)
        if (userDeposited != null && userDeposited > 0n && userDepositedWeight != null && userDepositedWeight > 0n) {
            const userShare = Number(userDepositedWeight) / Number(totalDepositedWeight);
            const userRewardsPerYear = rewardsPerYearRaw * userShare;
            const userDep = Number(formatUnits(userDeposited, decimals));
            if (userDep > 0) {
                userApr = (userRewardsPerYear / userDep) * 100;
            }
        }
    }

    const formatApr = (apr) => {
        if (apr == null) return '—';
        if (apr > 1_000_000) return `${(apr / 1_000_000).toFixed(2)}M`;
        if (apr > 1_000) return `${(apr / 1_000).toFixed(2)}K`;
        return apr.toFixed(2);
    };

    return (
        <div className="glass-panel" style={{ marginBottom: '2rem' }}>
            <h2 className="flex-center" style={{ gap: '0.75rem', marginBottom: '1.5rem', justifyContent: 'flex-start' }}>
                <Activity className="text-gradient" />
                Pool Overview
            </h2>

            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                {/* TVL */}
                <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.01)' }}>
                    <div className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <Layers size={16} /> Total Value Locked
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                        {formattedTVL}
                        <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                            {tokenSymbol || 'Tokens'}
                        </span>
                    </div>
                </div>

                {/* Remaining Rewards */}
                <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(59,130,246,0.05)', borderColor: 'rgba(59,130,246,0.15)' }}>
                    <div className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <Vault size={16} /> Remaining Rewards
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--accent-primary)' }}>
                        {remainingRewards != null ? remainingRewards.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—'}
                        <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                            {rwdSymbol}
                        </span>
                    </div>
                </div>

                {/* Pool Average APR */}
                <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.15)' }}>
                    <div className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <Percent size={16} /> Pool Avg APR
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--accent-success)' }}>
                        {formatApr(poolAvgApr)}%
                    </div>
                </div>

                {/* Your Personal APR */}
                <div className="glass-panel" style={{ padding: '1rem', background: userApr != null ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.01)', borderColor: userApr != null ? 'rgba(139,92,246,0.2)' : undefined }}>
                    <div className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <TrendingUp size={16} /> Your APR
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: userApr != null ? 'var(--accent-secondary)' : 'var(--text-tertiary)' }}>
                        {userApr != null ? `${formatApr(userApr)}%` : 'N/A'}
                    </div>
                    {userApr != null && poolAvgApr != null && userApr > poolAvgApr && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--accent-success)', marginTop: '0.25rem' }}>
                            ✨ {((userApr / poolAvgApr - 1) * 100).toFixed(0)}% boost vs avg
                        </div>
                    )}
                </div>

                {/* Reward Rate */}
                <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.01)' }}>
                    <div className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <TrendingUp size={16} /> Reward Rate
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                        {formattedRewardRate}
                        <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>/ block</span>
                    </div>
                </div>

                {/* Penalty */}
                <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.01)' }}>
                    <div className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <Clock size={16} /> Immediate Penalty
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                        {penaltyPercent != null ? penaltyPercent.toString() : '—'}%
                    </div>
                </div>
            </div>
        </div>
    );
}
