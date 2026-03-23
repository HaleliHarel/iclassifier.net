import React, { useEffect, useRef } from 'react';
import { Network } from 'vis-network';

interface NetworkNode {
  id: number;
  label: string;
  color?: any;
  font?: any;
  shape?: string;
  image?: string;
  size?: number;
}

interface NetworkEdge {
  from: number;
  to: number;
  label?: string;
}

interface NetworkData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

interface VisNetworkProps {
  data: NetworkData;
  options?: any;
  className?: string;
  freezeAfterStabilization?: boolean;
}

const defaultOptions = {
  nodes: {
    borderWidth: 2,
    size: 30,
    color: {
      border: '#2563EB',
      background: '#93C5FD'
    },
    font: {
      size: 14,
      face: 'Roboto'
    }
  },
  edges: {
    color: 'gray',
    width: 2,
    arrows: {
      to: { enabled: false }
    },
    font: {
      size: 12
    }
  },
  physics: {
    enabled: true,
    stabilization: { iterations: 100 }
  },
  layout: {
    randomSeed: 2
  }
};

export default function VisNetwork({
  data,
  options = {},
  className = '',
  freezeAfterStabilization = true
}: VisNetworkProps) {
  const networkRef = useRef<HTMLDivElement>(null);
  const networkInstance = useRef<Network | null>(null);
  const isFrozenRef = useRef(false);
  const lastDataRef = useRef<NetworkData | null>(null);
  const freezeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!networkRef.current || !data) return;

    if (lastDataRef.current !== data) {
      isFrozenRef.current = false;
      lastDataRef.current = data;
    }

    const mergedOptions = { ...defaultOptions, ...options };
    if (freezeAfterStabilization && isFrozenRef.current) {
      mergedOptions.physics = { ...(mergedOptions.physics || {}), enabled: false };
    }

    try {
      if (!networkInstance.current) {
        networkInstance.current = new Network(networkRef.current, data, mergedOptions);
      } else {
        networkInstance.current.setData(data);
        networkInstance.current.setOptions(mergedOptions);
      }

      if (freezeAfterStabilization && mergedOptions.physics?.enabled) {
        if (freezeTimerRef.current) {
          window.clearTimeout(freezeTimerRef.current);
        }
        networkInstance.current.once('stabilizationIterationsDone', () => {
          isFrozenRef.current = true;
          networkInstance.current?.setOptions({ physics: { enabled: false } });
        });
        freezeTimerRef.current = window.setTimeout(() => {
          isFrozenRef.current = true;
          networkInstance.current?.setOptions({ physics: { enabled: false } });
        }, 5000);
      }
    } catch (error) {
      console.error('Error creating vis network:', error);
    }
  }, [data, options, freezeAfterStabilization]);

  useEffect(() => {
    return () => {
      if (freezeTimerRef.current) {
        window.clearTimeout(freezeTimerRef.current);
        freezeTimerRef.current = null;
      }
      if (networkInstance.current) {
        networkInstance.current.destroy();
        networkInstance.current = null;
      }
    };
  }, []);

  return (
    <div 
      ref={networkRef} 
      className={`w-full h-96 border border-gray-300 rounded-lg ${className}`}
      style={{ height: '400px' }}
    />
  );
}
