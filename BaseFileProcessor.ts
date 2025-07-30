// backend/services/pdr1/processors/BaseFileProcessor.ts

import { PrismaClient } from '@prisma/client';
import { NUMERIC_COLUMNS, DATE_COLUMNS } from '../pdr1Types'; 

export abstract class BaseFileProcessor {
  protected prisma: PrismaClient;
  protected readonly DIVISION_FACTOR = 10000000; // 10^7 for converting to crores

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Process value based on column type
   */
  protected processValue(column: string, value: any): any {
    if (value === 'blank' || value === '' || value === null || value === undefined) {
      return null;
    }

    if (NUMERIC_COLUMNS.includes(column)) {
      if (value === 'float') return null;
      const strValue = value.toString().replace(/,/g, '');
      const num = parseFloat(strValue);
      return isNaN(num) ? null : num;
    }

    if (DATE_COLUMNS.includes(column)) {
      return this.parseDate(value);
    }

    const intColumns = ['tenor'];
    if (intColumns.includes(column)) {
      const num = parseInt(value.toString());
      return isNaN(num) ? null : num;
    }

    return value.toString();
  }

  /**
   * Parse date from various formats
   */
  protected parseDate(dateValue: any): Date | null {
    if (!dateValue || dateValue === 'blank') return null;

    try {
      let year: number, month: number, day: number;

      if (dateValue instanceof Date) {
        year = dateValue.getUTCFullYear();
        month = dateValue.getUTCMonth();
        day = dateValue.getUTCDate();
      } else {
        const dateString = dateValue.toString().trim();
        
        // Handle yyyy-mm-dd format (with or without time)
        if (dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
          // Extract just the date part
          const datePart = dateString.split(' ')[0];
          const [yearStr, monthStr, dayStr] = datePart.split('-');
          year = parseInt(yearStr, 10);
          month = parseInt(monthStr, 10) - 1; // JavaScript months are 0-indexed
          day = parseInt(dayStr, 10);
          
          if (isNaN(year) || isNaN(month) || isNaN(day)) {
            console.error(`Invalid date components: ${dateString}`);
            return null;
          }
        }
        // Handle dd-mmm-yyyy format
        else if (dateString.includes('-') && dateString.length <= 11) {
          const parts = dateString.split('-');
          if (parts.length === 3) {
            day = parseInt(parts[0], 10);
            const monthStr = parts[1].substring(0, 3).charAt(0).toUpperCase() + 
                            parts[1].substring(1, 3).toLowerCase();
            year = parseInt(parts[2], 10);

            const months: Record<string, number> = {
              Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
              Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
            };
            month = months[monthStr];

            if (isNaN(day) || month === undefined || isNaN(year)) {
              console.error(`Invalid date components: ${dateString}`);
              return null;
            }
          } else {
            return null;
          }
        } 
        // Handle mm/dd/yyyy or dd/mm/yyyy formats
        else if (dateString.includes('/')) {
          const parts = dateString.split('/');
          if (parts.length === 3) {
            // Assuming mm/dd/yyyy format for now
            month = parseInt(parts[0], 10) - 1;
            day = parseInt(parts[1], 10);
            year = parseInt(parts[2], 10);
            
            if (isNaN(month) || isNaN(day) || isNaN(year)) {
              console.error(`Invalid date components: ${dateString}`);
              return null;
            }
          } else {
            return null;
          }
        }
        // Try parsing as standard date
        else {
          const parsed = new Date(dateString);
          if (isNaN(parsed.getTime())) {
            console.error(`Could not parse date: ${dateString}`);
            return null;
          }
          return parsed;
        }
      }

      const date = new Date(Date.UTC(year, month, day));
      if (isNaN(date.getTime())) {
        console.error(`Invalid date created from: ${dateValue}`);
        return null;
      }
      return date;
    } catch (error) {
      console.error('Date parsing error:', error, 'Value:', dateValue);
      return null;
    }
  }

  /**
   * Format date to DD-MMM-YYYY
   */
  protected formatDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    return `${day}-${month}-${year}`;
  }
}