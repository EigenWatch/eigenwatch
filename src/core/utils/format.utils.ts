export class FormatUtils {
  static formatLargeNumber(value: number): string {
    if (value >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(1)}B`;
    }
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
      return `${(value / 1_000).toFixed(1)}K`;
    }
    return value.toString();
  }

  static formatAddress(
    address: string,
    prefixLen: number = 6,
    suffixLen: number = 4
  ): string {
    if (address.length <= prefixLen + suffixLen) {
      return address;
    }
    return `${address.slice(0, prefixLen)}...${address.slice(-suffixLen)}`;
  }

  static formatPercentage(value: number, decimals: number = 2): string {
    return `${value.toFixed(decimals)}%`;
  }

  static bipsToPercentage(bips: number): string {
    const percentage = (bips / 10000) * 100;
    return this.formatPercentage(percentage);
  }

  static formatDateTime(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toISOString();
  }

  static formatRelativeTime(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - d.getTime();

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  }

  static formatDecimal(value: string | number, decimals: number = 18): string {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return (num / Math.pow(10, decimals)).toFixed(4);
  }
}
