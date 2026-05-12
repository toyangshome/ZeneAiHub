import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: 24,
          fontFamily: 'monospace',
        }}>
          <h2 style={{ marginBottom: 16, color: '#ff4d4f' }}>应用出错了</h2>
          <pre style={{
            background: 'var(--ant-color-fill-tertiary)',
            padding: 16,
            borderRadius: 12,
            maxWidth: 600,
            overflow: 'auto',
            fontSize: 13,
          }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: '8px 24px',
              cursor: 'pointer',
              border: '1px solid var(--ant-color-border)',
              borderRadius: 10,
              background: '#fff',
            }}
          >
            重新加载
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
