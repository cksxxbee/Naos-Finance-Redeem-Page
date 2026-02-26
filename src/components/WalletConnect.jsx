import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import { bsc, bscTestnet } from 'wagmi/chains';
import { Wallet, LogOut, CheckCircle2 } from 'lucide-react';

const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export default function WalletConnect() {
    const { address, isConnected } = useAccount();
    const { connectors, connect, isPending } = useConnect();
    const { disconnect } = useDisconnect();
    const chainId = useChainId();
    const { switchChain } = useSwitchChain();

    const isBscNetwork = chainId === bsc.id || chainId === bscTestnet.id;

    if (isConnected) {
        return (
            <div className="flex-center" style={{ gap: '1rem' }}>
                <div className="flex-center" style={{ gap: '0.5rem' }}>
                    <span className={`badge ${isBscNetwork ? 'badge-active' : ''}`}>
                        {isBscNetwork ? (
                            <span className="flex-center" style={{ gap: '0.25rem' }}>
                                <CheckCircle2 size={12} /> {chainId === bsc.id ? 'BSC Mainnet' : 'BSC Testnet'}
                            </span>
                        ) : (
                            'Wrong Network'
                        )}
                    </span>
                    <span className="glass-panel" style={{ padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.875rem' }}>
                        {formatAddress(address)}
                    </span>
                </div>

                {!isBscNetwork && (
                    <button
                        className="btn btn-primary"
                        onClick={() => switchChain({ chainId: bsc.id })}
                        style={{ padding: '0.4rem 1rem' }}
                    >
                        Switch to BSC
                    </button>
                )}

                <button
                    className="btn btn-outline"
                    onClick={() => disconnect()}
                    title="Disconnect Wallet"
                    style={{ padding: '0.4rem', borderRadius: '50%' }}
                >
                    <LogOut size={16} />
                </button>
            </div>
        );
    }

    // Find injected connector (e.g. MetaMask, TrustWallet)
    const injectedConnector = connectors.find(c => c.type === 'injected');

    return (
        <div>
            <button
                className="btn btn-primary"
                onClick={() => injectedConnector && connect({ connector: injectedConnector })}
                disabled={isPending}
            >
                <Wallet size={18} />
                {isPending ? 'Connecting...' : 'Connect Wallet'}
            </button>
        </div>
    );
}
