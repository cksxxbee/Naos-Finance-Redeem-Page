import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { boostPoolAbi, erc20Abi, BOOST_POOL_ADDRESS } from '../abi/contracts';
import { User, ArrowDownToLine, ArrowUpFromLine, ShieldAlert, Sparkles, AlertCircle, Clock, Timer, CheckCircle2, Gift } from 'lucide-react';

const CONTRACT_ADDRESS = BOOST_POOL_ADDRESS;

// Helper: format remaining seconds into d h m s
function formatCountdown(seconds) {
    if (seconds <= 0) return 'Ready!';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
}

export default function UserDashboard() {
    const { address } = useAccount();
    const [depositAmount, setDepositAmount] = useState('');
    const [lockIndex, setLockIndex] = useState(0);
    const [now, setNow] = useState(Math.floor(Date.now() / 1000));

    // Tick every second for countdown
    useEffect(() => {
        const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
        return () => clearInterval(timer);
    }, []);

    // ─── Read: Pool Token ───
    const { data: poolTokenAddress } = useReadContract({
        address: CONTRACT_ADDRESS, abi: boostPoolAbi, functionName: 'getPoolToken',
    });

    const { data: tokenDecimals } = useReadContract({
        address: poolTokenAddress ?? undefined, abi: erc20Abi, functionName: 'decimals',
        query: { enabled: !!poolTokenAddress },
    });

    const { data: tokenSymbol } = useReadContract({
        address: poolTokenAddress ?? undefined, abi: erc20Abi, functionName: 'symbol',
        query: { enabled: !!poolTokenAddress },
    });

    // ─── Read: User balance & allowance ───
    const { data: userTokenBalance, refetch: refetchBalance } = useReadContract({
        address: poolTokenAddress ?? undefined, abi: erc20Abi, functionName: 'balanceOf',
        args: [address], query: { enabled: !!address && !!poolTokenAddress },
    });

    const { data: tokenAllowance, refetch: refetchAllowance } = useReadContract({
        address: poolTokenAddress ?? undefined, abi: erc20Abi, functionName: 'allowance',
        args: [address, CONTRACT_ADDRESS], query: { enabled: !!address && !!poolTokenAddress },
    });

    // ─── Read: User stake info ───
    const { data: stakeTotalDeposited, refetch: refetchStakeInfo } = useReadContract({
        address: CONTRACT_ADDRESS, abi: boostPoolAbi, functionName: 'getStakeTotalDeposited',
        args: [address], query: { enabled: !!address },
    });

    const { data: unclaimedImmediately, refetch: refetchUnclaimed1 } = useReadContract({
        address: CONTRACT_ADDRESS, abi: boostPoolAbi, functionName: 'getStakeTotalUnclaimedImmediately',
        args: [address], query: { enabled: !!address },
    });

    const { data: unclaimedTotal, refetch: refetchUnclaimed2 } = useReadContract({
        address: CONTRACT_ADDRESS, abi: boostPoolAbi, functionName: 'getStakeTotalUnclaimed',
        args: [address], query: { enabled: !!address },
    });

    // ─── Read: Cooldown status ───
    const { data: claimPeriod, refetch: refetchClaimPeriod } = useReadContract({
        address: CONTRACT_ADDRESS, abi: boostPoolAbi, functionName: 'getUserClaimPeriod',
        args: [address], query: { enabled: !!address, refetchInterval: 5000 },
    });

    const { data: cooldownPeriodSec } = useReadContract({
        address: CONTRACT_ADDRESS, abi: boostPoolAbi, functionName: 'cooldownPeriod',
    });

    // ─── Read: Lock Time Weights ───
    const { data: lockWeightCount } = useReadContract({
        address: CONTRACT_ADDRESS, abi: boostPoolAbi, functionName: 'getLockTimeWeightedListLength',
    });

    // ─── Read: User deposit orders ───
    const { data: userOrderCount, refetch: refetchOrderCount } = useReadContract({
        address: CONTRACT_ADDRESS, abi: boostPoolAbi, functionName: 'getUserOrderCount',
        args: [address], query: { enabled: !!address },
    });

    const orderCount = userOrderCount != null ? Number(userOrderCount) : 0;

    // Build contracts array for multicall to read all orders
    const orderContracts = orderCount > 0
        ? [...Array(orderCount)].map((_, i) => ({
            address: CONTRACT_ADDRESS,
            abi: boostPoolAbi,
            functionName: 'getUserDepositOrderByIndex',
            args: [address, BigInt(i)],
        }))
        : [];

    const { data: ordersData, refetch: refetchOrders } = useReadContracts({
        contracts: orderContracts,
        query: { enabled: orderCount > 0 },
    });

    // ─── Write Setup ───
    const { writeContract, data: txHash, isPending } = useWriteContract();
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

    useEffect(() => {
        if (isConfirmed) {
            refetchBalance?.(); refetchAllowance?.(); refetchStakeInfo?.();
            refetchUnclaimed1?.(); refetchUnclaimed2?.(); refetchClaimPeriod?.();
            refetchOrderCount?.(); refetchOrders?.();
        }
    }, [isConfirmed]);

    const decimals = tokenDecimals ?? 18;
    const sym = tokenSymbol || '';

    // ─── Cooldown state logic ───
    const claimStart = claimPeriod ? Number(claimPeriod[0]) : 0;
    const claimEnd = claimPeriod ? Number(claimPeriod[1]) : 0;
    const hasCooldown = claimStart > 0 || claimEnd > 0;
    const isInCooldown = hasCooldown && now < claimStart;
    const isInClaimWindow = hasCooldown && now >= claimStart && now <= claimEnd;
    const cooldownExpired = hasCooldown && now > claimEnd;
    const cooldownDays = cooldownPeriodSec != null ? Math.round(Number(cooldownPeriodSec) / 86400) : 7;

    // ─── Handlers ───
    const handleDeposit = () => {
        if (!depositAmount || Number(depositAmount) <= 0) return;
        const amountBigInt = parseUnits(depositAmount, decimals);
        if (tokenAllowance == null || tokenAllowance < amountBigInt) {
            writeContract({ address: poolTokenAddress, abi: erc20Abi, functionName: 'approve', args: [CONTRACT_ADDRESS, amountBigInt] });
            return;
        }
        writeContract({ address: CONTRACT_ADDRESS, abi: boostPoolAbi, functionName: 'deposit', args: [amountBigInt, BigInt(lockIndex)] });
    };

    const handleWithdraw = (indices) => {
        writeContract({ address: CONTRACT_ADDRESS, abi: boostPoolAbi, functionName: 'withdraw', args: [indices.map(i => BigInt(i))] });
    };

    const handleStartCooldown = () => {
        writeContract({ address: CONTRACT_ADDRESS, abi: boostPoolAbi, functionName: 'startCoolDown' });
    };

    const handleClaim = () => {
        writeContract({ address: CONTRACT_ADDRESS, abi: boostPoolAbi, functionName: 'claim' });
    };

    const handleClaimImmediately = () => {
        writeContract({ address: CONTRACT_ADDRESS, abi: boostPoolAbi, functionName: 'claimImmediately' });
    };

    const formatAmount = (val) => {
        if (val == null) return '—';
        return Number(formatUnits(val, decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 });
    };

    const getDepositButtonLabel = () => {
        if (!depositAmount || Number(depositAmount) <= 0) return 'Stake';
        try {
            const a = parseUnits(depositAmount, decimals);
            if (tokenAllowance == null || tokenAllowance < a) return 'Approve Token';
        } catch (e) { /* */ }
        return 'Stake';
    };

    const lockCount = lockWeightCount != null ? Number(lockWeightCount) : 0;
    const isWorking = isPending || isConfirming;

    // Build order list
    const orders = (ordersData || []).map((r, i) => {
        if (r.status !== 'success' || !r.result) return null;
        const [amount, expiredTime, weighted, isWithdraw] = r.result;
        return { index: i, amount, expiredTime: Number(expiredTime), weighted: Number(weighted), isWithdraw };
    }).filter(Boolean);

    const withdrawableIndices = orders.filter(o => !o.isWithdraw && o.expiredTime < now).map(o => o.index);

    return (
        <div className="glass-panel">
            <h2 className="flex-center" style={{ gap: '0.75rem', marginBottom: '1.5rem', justifyContent: 'flex-start' }}>
                <User className="text-gradient" /> Your Farming Dashboard
            </h2>

            {/* ── Stats ── */}
            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(59,130,246,0.05)', borderColor: 'rgba(59,130,246,0.2)' }}>
                    <div className="input-label" style={{ marginBottom: '0.5rem' }}>Your Staked Tokens</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--accent-primary)' }}>
                        {formatAmount(stakeTotalDeposited)} <span style={{ fontSize: '1rem' }}>{sym}</span>
                    </div>
                </div>
                <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.2)' }}>
                    <div className="input-label" style={{ marginBottom: '0.5rem' }}>Full Pending Rewards</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--accent-success)' }}>
                        {formatAmount(unclaimedTotal)} <span style={{ fontSize: '1rem' }}>RWD</span>
                    </div>
                </div>
                <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.2)' }}>
                    <div className="input-label" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        Available (with penalty) <AlertCircle size={14} />
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--accent-warning)' }}>
                        {formatAmount(unclaimedImmediately)} <span style={{ fontSize: '1rem' }}>RWD</span>
                    </div>
                </div>
            </div>

            {/* ── Claim Rewards Flow ── */}
            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem', marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sparkles size={20} /> Claim Rewards
                </h3>

                {/* Cooldown Status Card */}
                <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1rem', background: 'rgba(139,92,246,0.05)', borderColor: 'rgba(139,92,246,0.15)' }}>
                    <div className="input-label" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Timer size={16} /> Cooldown Status
                    </div>

                    {!hasCooldown || cooldownExpired ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                            <Clock size={16} /> No active cooldown
                        </div>
                    ) : isInCooldown ? (
                        <div>
                            <div style={{ color: 'var(--accent-secondary)', fontWeight: '600', fontSize: '1.25rem', marginBottom: '0.25rem' }}>
                                ⏳ Cooling down... {formatCountdown(claimStart - now)}
                            </div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
                                Claim window opens: {new Date(claimStart * 1000).toLocaleString()}
                            </div>
                        </div>
                    ) : isInClaimWindow ? (
                        <div>
                            <div style={{ color: 'var(--accent-success)', fontWeight: '600', fontSize: '1.25rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <CheckCircle2 size={20} /> Claim window is OPEN!
                            </div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
                                Window closes in: {formatCountdown(claimEnd - now)} ({new Date(claimEnd * 1000).toLocaleString()})
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Claim Flow Description */}
                <div style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginBottom: '1rem', lineHeight: '1.8' }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>領取流程：</strong>
                    Step 1: Start Cooldown → Step 2: 等待 {cooldownDays} 天冷卻期 → Step 3: 在 24 小時領取視窗內 Claim 全額獎勵（無懲罰）
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    {/* Step 1: Start Cooldown */}
                    <button
                        className="btn btn-primary"
                        onClick={handleStartCooldown}
                        disabled={isWorking || (isInCooldown || isInClaimWindow)}
                        style={{ width: '100%' }}
                    >
                        <Clock size={16} /> Step 1: Start Cooldown
                    </button>

                    {/* Step 3: Claim (full, no penalty) */}
                    <button
                        className="btn btn-primary"
                        onClick={handleClaim}
                        disabled={isWorking || !isInClaimWindow}
                        style={{ width: '100%', background: isInClaimWindow ? 'linear-gradient(135deg, #10b981, #059669)' : undefined, boxShadow: isInClaimWindow ? '0 4px 12px rgba(16,185,129,0.4)' : undefined }}
                    >
                        <Gift size={16} /> Step 3: Claim Full Rewards
                    </button>
                </div>

                {/* Alternative: Claim Immediately with penalty */}
                <div style={{ marginTop: '1rem' }}>
                    <button
                        className="btn btn-danger"
                        onClick={handleClaimImmediately}
                        disabled={isWorking || unclaimedImmediately == null || unclaimedImmediately === 0n}
                        style={{ width: '100%' }}
                    >
                        <ShieldAlert size={16} /> Claim Immediately（扣除懲罰 penalty）
                    </button>
                </div>
            </div>

            {/* ── Deposit Section ── */}
            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem', marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ArrowDownToLine size={20} /> Stake Tokens
                </h3>
                <div className="input-group">
                    <div className="flex-between">
                        <label className="input-label">Amount</label>
                        <span className="input-label" style={{ cursor: 'pointer', color: 'var(--accent-primary)' }}
                            onClick={() => { if (userTokenBalance != null) setDepositAmount(formatUnits(userTokenBalance, decimals)); }}>
                            Balance: {formatAmount(userTokenBalance)} {sym}
                        </span>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <input type="number" className="input-field" placeholder="0.00" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
                        <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: '600' }}>{sym}</span>
                    </div>
                </div>

                <div className="input-group">
                    <label className="input-label">Lock Time Config Index</label>
                    <select className="input-field" value={lockIndex} onChange={(e) => setLockIndex(Number(e.target.value))}
                        style={{ appearance: 'none', backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7em top 50%', backgroundSize: '.65em auto' }}>
                        {lockCount > 0
                            ? [...Array(lockCount)].map((_, i) => <option key={i} value={i} style={{ background: '#0f111a' }}>Config Index {i}</option>)
                            : <option value="0" style={{ background: '#0f111a' }}>Default Index 0</option>}
                    </select>
                </div>

                <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleDeposit} disabled={isWorking || !depositAmount}>
                    {isWorking && <span className="loader" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}></span>}
                    {getDepositButtonLabel()}
                </button>
            </div>

            {/* ── Deposit Orders & Withdraw ── */}
            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
                <div className="flex-between" style={{ marginBottom: '1rem' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ArrowUpFromLine size={20} /> Your Deposit Orders
                    </h3>
                    {withdrawableIndices.length > 0 && (
                        <button className="btn btn-outline" onClick={() => handleWithdraw(withdrawableIndices)} disabled={isWorking}
                            style={{ padding: '0.4rem 1rem' }}>
                            Withdraw All Unlocked ({withdrawableIndices.length})
                        </button>
                    )}
                </div>

                {orders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>
                        No deposit orders found.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                    <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', color: 'var(--text-tertiary)', fontWeight: '500' }}>#</th>
                                    <th style={{ textAlign: 'right', padding: '0.75rem 0.5rem', color: 'var(--text-tertiary)', fontWeight: '500' }}>Amount</th>
                                    <th style={{ textAlign: 'right', padding: '0.75rem 0.5rem', color: 'var(--text-tertiary)', fontWeight: '500' }}>Weight</th>
                                    <th style={{ textAlign: 'right', padding: '0.75rem 0.5rem', color: 'var(--text-tertiary)', fontWeight: '500' }}>Unlock Date</th>
                                    <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', color: 'var(--text-tertiary)', fontWeight: '500' }}>Status</th>
                                    <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', color: 'var(--text-tertiary)', fontWeight: '500' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((o) => {
                                    const unlocked = o.expiredTime < now;
                                    return (
                                        <tr key={o.index} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                            <td style={{ padding: '0.75rem 0.5rem' }}>{o.index}</td>
                                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>{formatAmount(o.amount)} {sym}</td>
                                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>x{o.weighted}</td>
                                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontSize: '0.8rem' }}>
                                                {new Date(o.expiredTime * 1000).toLocaleString()}
                                            </td>
                                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                                                {o.isWithdraw ? (
                                                    <span className="badge" style={{ background: 'rgba(100,116,139,0.1)', color: 'var(--text-tertiary)' }}>Withdrawn</span>
                                                ) : unlocked ? (
                                                    <span className="badge badge-active">Unlocked</span>
                                                ) : (
                                                    <span className="badge" style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--accent-warning)', border: '1px solid rgba(245,158,11,0.2)' }}>
                                                        🔒 {formatCountdown(o.expiredTime - now)}
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                                                {!o.isWithdraw && unlocked && (
                                                    <button className="btn btn-outline" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                                                        onClick={() => handleWithdraw([o.index])} disabled={isWorking}>
                                                        Withdraw
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
