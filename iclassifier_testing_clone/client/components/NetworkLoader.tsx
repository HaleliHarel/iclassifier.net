interface NetworkLoaderProps {
  title?: string;
  subtitle?: string;
  className?: string;
}

export default function NetworkLoader({ title, subtitle, className }: NetworkLoaderProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${className || ""}`}>
      <svg
        className="network-loader text-blue-600"
        viewBox="0 0 120 60"
        role="img"
        aria-hidden="true"
      >
        <line
          x1="20"
          y1="30"
          x2="100"
          y2="30"
          className="network-loader__line"
        />
        <circle cx="20" cy="30" r="6" className="network-loader__node" />
        <circle cx="100" cy="30" r="6" className="network-loader__node network-loader__node--right" />
      </svg>
      {title && <h3 className="text-xl font-semibold mt-4">{title}</h3>}
      {subtitle && <p className="text-gray-600">{subtitle}</p>}
    </div>
  );
}
