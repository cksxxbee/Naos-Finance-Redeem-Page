import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { stakingPoolsAbi, erc20Abi, STAKING_POOLS_ADDRESS } from '../abi/contracts';
import { Activity, ArrowDownToLine, ArrowUpFromLine, Sparkles, LogOut, Layers, TrendingUp, Percent } from 'lucide-react';

const CONTRACT = STAKING_POOLS_ADDRESS;
const BLOCKS_PER_YEAR_ETH = 2_628_000; // ~12s block time

export default function EthStakingDashboard() {
    const { address } = useAccount();
    const [selectedPool, setSelectedPool] = useState(0);
    const [depositAmount, setDepositAmount] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');

    // ─── Global reads ───
    const { data: poolCount } = useReadContract({
        address: CONTRACT, abi: stakingPoolsAbi, functionName: 'poolCount',
    });

    const { data: globalRewardRate } = useReadContract({
        address: CONTRACT, abi: stakingPoolsAbi, functionName: 'rewardRate',
        query: { refetchInterval: 30000 },
    });

    const { data: totalRewardWeight } = useReadContract({
        address: CONTRACT, abi: stakingPoolsAbi, functionName: 'totalRewardWeight',
    });

    const { data: rewardTokenAddr } = useReadContract({
        address: CONTRACT, abi: stakingPoolsAbi, functionName: 'reward',
    });

    const { data: rewardSymbol } = useReadContract({
        address: rewardTokenAddr ?? undefined, abi: erc20Abi, functionName: 'symbol',
        query: { enabled: !!rewardTokenAddr },
    });

    const count = poolCount != null ? Number(poolCount) : 0;

    // ─── Read all pool data via multicall ───
    const poolInfoContracts = count > 0 ? [...Array(count)].flatMap((_, i) => [
        { address: CONTRACT, abi: stakingPoolsAbi, functionName: 'getPoolToken', args: [BigInt(i)] },
        { address: CONTRACT, abi: stakingPoolsAbi, functionName: 'getPoolTotalDeposited', args: [BigInt(i)] },
        { address: CONTRACT, abi: stakingPoolsAbi, functionName: 'getPoolRewardWeight', args: [BigInt(i)] },
        { address: CONTRACT, abi: stakingPoolsAbi, functionName: 'getPoolRewardRate', args: [BigInt(i)] },
    ]) : [];

    const { data: poolRawData } = useReadContracts({
        contracts: poolInfoContracts,
        query: { enabled: count > 0, refetchInterval: 15000 },
    });

    // ─── Read token symbols/decimals for each pool ───
    const poolTokenAddresses = [];
    if (poolRawData) {
        for (let i = 0; i < count; i++) {
            const tokenResult = poolRawData[i * 4];
            if (tokenResult?.status === 'success') poolTokenAddresses.push(tokenResult.result);
            else poolTokenAddresses.push(null);
        }
    }

    const tokenInfoContracts = poolTokenAddresses.filter(Boolean).flatMap(addr => [
        { address: addr, abi: erc20Abi, functionName: 'symbol' },
        { address: addr, abi: erc20Abi, functionName: 'decimals' },
    ]);

    const { data: tokenInfoRaw } = useReadContracts({
        contracts: tokenInfoContracts,
        query: { enabled: tokenInfoContracts.length > 0 },
    });

    // Build pool info
    const pools = [];
    let tokenInfoIdx = 0;
    for (let i = 0; i < count; i++) {
        if (!poolRawData) break;
        const base = i * 4;
        const tokenAddr = poolRawData[base]?.status === 'success' ? poolRawData[base].result : null;
        const totalDep = poolRawData[base + 1]?.status === 'success' ? poolRawData[base + 1].result : 0n;
        const weight = poolRawData[base + 2]?.status === 'success' ? poolRawData[base + 2].result : 0n;
        const poolRR = poolRawData[base + 3]?.status === 'success' ? poolRawData[base + 3].result : 0n;

        let sym = 'Token', dec = 18;
        if (tokenAddr && tokenInfoRaw) {
            const si = poolTokenAddresses.filter(Boolean).indexOf(tokenAddr);
            if (si >= 0 && tokenInfoRaw[si * 2]?.status === 'success') sym = tokenInfoRaw[si * 2].result;
            if (si >= 0 && tokenInfoRaw[si * 2 + 1]?.status === 'success') dec = tokenInfoRaw[si * 2 + 1].result;
        }

        pools.push({ id: i, tokenAddr, totalDeposited: totalDep, rewardWeight: weight, poolRewardRate: poolRR, symbol: sym, decimals: dec });
    }

    const currentPool = pools[selectedPool];

    // ─── User-specific reads for selected pool ───
    const { data: userDeposited, refetch: refetchUserDep } = useReadContract({
        address: CONTRACT, abi: stakingPoolsAbi, functionName: 'getStakeTotalDeposited',
        args: [address, BigInt(selectedPool)],
        query: { enabled: !!address, refetchInterval: 10000 },
    });

    const { data: userUnclaimed, refetch: refetchUnclaimed } = useReadContract({
        address: CONTRACT, abi: stakingPoolsAbi, functionName: 'getStakeTotalUnclaimed',
        args: [address, BigInt(selectedPool)],
        query: { enabled: !!address, refetchInterval: 10000 },
    });

    const { data: userTokenBalance, refetch: refetchBal } = useReadContract({
        address: currentPool?.tokenAddr ?? undefined, abi: erc20Abi, functionName: 'balanceOf',
        args: [address],
        query: { enabled: !!address && !!currentPool?.tokenAddr },
    });

    const { data: tokenAllowance, refetch: refetchAllowance } = useReadContract({
        address: currentPool?.tokenAddr ?? undefined, abi: erc20Abi, functionName: 'allowance',
        args: [address, CONTRACT],
        query: { enabled: !!address && !!currentPool?.tokenAddr },
    });

    // ─── Write ───
    const { writeContract, data: txHash, isPending } = useWriteContract();
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

    useEffect(() => {
        if (isConfirmed) {
            refetchUserDep?.(); refetchUnclaimed?.(); refetchBal?.(); refetchAllowance?.();
        }
    }, [isConfirmed]);

    const isWorking = isPending || isConfirming;
    const dec = currentPool?.decimals ?? 18;
    const sym = currentPool?.symbol ?? 'Token';

    const fmt = (val, d) => {
        if (val == null) return '—';
        return Number(formatUnits(val, d ?? dec)).toLocaleString(undefined, { maximumFractionDigits: 6 });
    };

    // APR for selected pool
    let poolApr = null;
    if (currentPool && currentPool.poolRewardRate > 0n && currentPool.totalDeposited > 0n) {
        const rrPerYear = Number(formatUnits(currentPool.poolRewardRate, dec)) * BLOCKS_PER_YEAR_ETH;
        const tvl = Number(formatUnits(currentPool.totalDeposited, dec));
        if (tvl > 0) poolApr = (rrPerYear / tvl) * 100;
    }

    const fmtApr = (a) => {
        if (a == null) return '—';
        if (a > 1e6) return `${(a / 1e6).toFixed(2)}M`;
        if (a > 1e3) return `${(a / 1e3).toFixed(2)}K`;
        return a.toFixed(2);
    };

    // Handlers
    const handleDeposit = () => {
        if (!depositAmount || Number(depositAmount) <= 0) return;
        const amt = parseUnits(depositAmount, dec);
        if (tokenAllowance == null || tokenAllowance < amt) {
            writeContract({ address: currentPool.tokenAddr, abi: erc20Abi, functionName: 'approve', args: [CONTRACT, amt] });
            return;
        }
        writeContract({ address: CONTRACT, abi: stakingPoolsAbi, functionName: 'deposit', args: [BigInt(selectedPool), amt] });
    };

    const handleWithdraw = () => {
        if (!withdrawAmount || Number(withdrawAmount) <= 0) return;
        writeContract({ address: CONTRACT, abi: stakingPoolsAbi, functionName: 'withdraw', args: [BigInt(selectedPool), parseUnits(withdrawAmount, dec)] });
    };

    const handleClaim = () => {
        writeContract({ address: CONTRACT, abi: stakingPoolsAbi, functionName: 'claim', args: [BigInt(selectedPool)] });
    };

    const handleExit = () => {
        writeContract({ address: CONTRACT, abi: stakingPoolsAbi, functionName: 'exit', args: [BigInt(selectedPool)] });
    };

    const getDepositLabel = () => {
        if (!depositAmount || Number(depositAmount) <= 0) return 'Stake';
        try { const a = parseUnits(depositAmount, dec); if (tokenAllowance == null || tokenAllowance < a) return 'Approve Token'; } catch { }
        return 'Stake';
    };

    return (
        <>
            {/* Pool Selector */}
            <div className="glass-panel" style={{ marginBottom: '2rem' }}>
                <h2 className="flex-center" style={{ gap: '0.75rem', marginBottom: '1.5rem', justifyContent: 'flex-start' }}>
                    <Activity className="text-gradient" /> ETH Staking Pools
                </h2>

                {count === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>Loading pools...</div>
                ) : (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                        {pools.map((p) => (
                            <button key={p.id}
                                className={`btn ${selectedPool === p.id ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => { setSelectedPool(p.id); setDepositAmount(''); setWithdrawAmount(''); }}
                                style={{ minWidth: '120px' }}>
                                Pool #{p.id} — {p.symbol}
                            </button>
                        ))}
                    </div>
                )}

                {/* Selected Pool Stats */}
                {currentPool && (
                    <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
                        <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.01)' }}>
                            <div className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <Layers size={16} /> TVL
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                                {fmt(currentPool.totalDeposited)} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{sym}</span>
                            </div>
                        </div>

                        <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.15)' }}>
                            <div className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <Percent size={16} /> Pool APR
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--accent-success)' }}>
                                {fmtApr(poolApr)}%
                            </div>
                        </div>

                        <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.01)' }}>
                            <div className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <TrendingUp size={16} /> Reward Rate
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                                {fmt(currentPool.poolRewardRate)} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>/ block</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* User Actions Panel */}
            {currentPool && (
                <div className="glass-panel">
                    <h2 className="flex-center" style={{ gap: '0.75rem', marginBottom: '1.5rem', justifyContent: 'flex-start' }}>
                        <Sparkles className="text-gradient" /> Pool #{selectedPool} — Your Position
                    </h2>

                    {/* Stats */}
                    <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                        <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(59,130,246,0.05)', borderColor: 'rgba(59,130,246,0.2)' }}>
                            <div className="input-label" style={{ marginBottom: '0.5rem' }}>Your Staked</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--accent-primary)' }}>
                                {fmt(userDeposited)} <span style={{ fontSize: '1rem' }}>{sym}</span>
                            </div>
                        </div>
                        <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.2)' }}>
                            <div className="input-label" style={{ marginBottom: '0.5rem' }}>Pending Rewards</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--accent-success)' }}>
                                {fmt(userUnclaimed)} <span style={{ fontSize: '1rem' }}>{rewardSymbol || 'RWD'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Deposit */}
                    <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem', marginBottom: '2rem' }}>
                        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <ArrowDownToLine size={20} /> Stake Tokens
                        </h3>
                        <div className="input-group">
                            <div className="flex-between">
                                <label className="input-label">Amount</label>
                                <span className="input-label" style={{ cursor: 'pointer', color: 'var(--accent-primary)' }}
                                    onClick={() => { if (userTokenBalance != null) setDepositAmount(formatUnits(userTokenBalance, dec)); }}>
                                    Balance: {fmt(userTokenBalance)} {sym}
                                </span>
                            </div>
                            <input type="number" className="input-field" placeholder="0.00" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
                        </div>
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleDeposit} disabled={isWorking || !depositAmount}>
                            {isWorking && <span className="loader" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}></span>}
                            {getDepositLabel()}
                        </button>
                    </div>

                    {/* Withdraw */}
                    <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem', marginBottom: '2rem' }}>
                        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <ArrowUpFromLine size={20} /> Withdraw Tokens
                        </h3>
                        <div className="input-group">
                            <div className="flex-between">
                                <label className="input-label">Amount</label>
                                <span className="input-label" style={{ cursor: 'pointer', color: 'var(--accent-primary)' }}
                                    onClick={() => { if (userDeposited != null) setWithdrawAmount(formatUnits(userDeposited, dec)); }}>
                                    Staked: {fmt(userDeposited)} {sym}
                                </span>
                            </div>
                            <input type="number" className="input-field" placeholder="0.00" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} />
                        </div>
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleWithdraw} disabled={isWorking || !withdrawAmount}>
                            Withdraw
                        </button>
                    </div>

                    {/* Claim & Exit */}
                    <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Sparkles size={20} /> Claim & Exit
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <button className="btn btn-primary" onClick={handleClaim} disabled={isWorking || userUnclaimed == null || userUnclaimed === 0n}
                                style={{ width: '100%', background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
                                <Sparkles size={16} /> Claim Rewards
                            </button>
                            <button className="btn btn-danger" onClick={handleExit} disabled={isWorking || userDeposited == null || userDeposited === 0n}
                                style={{ width: '100%' }}>
                                <LogOut size={16} /> Exit (Claim + Withdraw All)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
