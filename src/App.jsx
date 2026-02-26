import { useState } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { mainnet, bsc } from 'wagmi/chains';
import WalletConnect from './components/WalletConnect';
import ContractInfo from './components/ContractInfo';
import UserDashboard from './components/UserDashboard';
import EthStakingDashboard from './components/EthStakingDashboard';
import { Rocket } from 'lucide-react';

const NETWORKS = [
  { id: 'eth', label: 'Ethereum', chainId: mainnet.id, icon: '⟠', color: '#627eea', desc: 'StakingPools — Multi-Pool Staking' },
  { id: 'bsc', label: 'BSC', chainId: bsc.id, icon: '⛓', color: '#f0b90b', desc: 'BoostPool — Weighted Yield Farming' },
];

function App() {
  const { isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const [activeTab, setActiveTab] = useState(() => {
    // Auto-select based on connected chain
    if (chain?.id === mainnet.id) return 'eth';
    return 'bsc';
  });

  const handleTabSwitch = (networkId) => {
    setActiveTab(networkId);
    const target = NETWORKS.find(n => n.id === networkId);
    if (target && chain?.id !== target.chainId && isConnected) {
      switchChain?.({ chainId: target.chainId });
    }
  };

  const currentNetwork = NETWORKS.find(n => n.id === activeTab);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header flex-between">
        <div className="flex-center" style={{ gap: '0.75rem' }}>
          <div className="flex-center" style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2))',
            padding: '0.75rem',
            borderRadius: '12px',
            boxShadow: '0 0 15px rgba(59, 130, 246, 0.3)'
          }}>
            <Rocket className="text-gradient" size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '0.2rem' }}>NAOS <span className="text-gradient">Dashboard</span></h1>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{currentNetwork?.desc}</div>
          </div>
        </div>

        <WalletConnect />
      </header>

      {/* Network Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '2rem',
        padding: '0.35rem',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '16px',
        border: '1px solid var(--glass-border)',
      }}>
        {NETWORKS.map(net => {
          const isActive = activeTab === net.id;
          const isOnChain = chain?.id === net.chainId;
          return (
            <button key={net.id}
              onClick={() => handleTabSwitch(net.id)}
              style={{
                flex: 1,
                padding: '0.85rem 1.25rem',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: '600',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.3s ease',
                background: isActive
                  ? `linear-gradient(135deg, ${net.color}22, ${net.color}11)`
                  : 'transparent',
                color: isActive ? net.color : 'var(--text-tertiary)',
                boxShadow: isActive ? `0 0 20px ${net.color}15, inset 0 0 0 1px ${net.color}33` : 'none',
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>{net.icon}</span>
              {net.label}
              {isConnected && isOnChain && (
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: 'var(--accent-success)',
                  boxShadow: '0 0 6px var(--accent-success)',
                }}></span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Content */}
      <main>
        {isConnected ? (
          activeTab === 'bsc' ? (
            <>
              <ContractInfo />
              <UserDashboard />
            </>
          ) : (
            <EthStakingDashboard />
          )
        ) : (
          <div className="glass-panel" style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            maxWidth: '600px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.5rem'
          }}>
            <div className="flex-center" style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'rgba(59, 130, 246, 0.1)',
              marginBottom: '1rem'
            }}>
              <Rocket size={40} className="text-gradient" />
            </div>
            <h2>Connect Your Wallet to Start</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
              Connect your Web3 wallet to stake tokens, earn rewards, and manage your portfolio across Ethereum and BSC.
            </p>
            <div style={{ marginTop: '1rem' }}>
              <WalletConnect />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
