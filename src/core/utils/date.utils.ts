export class DateUtils {
  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  static subtractDays(date: Date, days: number): Date {
    return this.addDays(date, -days);
  }

  static startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  static endOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  static parseRelativeDate(relative: string): Date {
    const match = relative.match(/^(\d+)([dDwWmMyY])$/);
    if (!match) {
      throw new Error(`Invalid relative date format: ${relative}`);
    }

    const [, amount, unit] = match;
    const days = parseInt(amount, 10);
    const now = new Date();

    switch (unit.toLowerCase()) {
      case "d":
        return this.subtractDays(now, days);
      case "w":
        return this.subtractDays(now, days * 7);
      case "m":
        return this.subtractDays(now, days * 30);
      case "y":
        return this.subtractDays(now, days * 365);
      default:
        throw new Error(`Invalid date unit: ${unit}`);
    }
  }
}
