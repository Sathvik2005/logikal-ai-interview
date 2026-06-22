import { Injectable } from '@nestjs/common';

@Injectable()
export class FeatureFlagsService {
  isEnabled(flag: string): boolean {
    const envValue = process.env[`FLAG_${flag.toUpperCase()}`] || process.env[flag.toUpperCase()];
    if (envValue === 'false' || envValue === '0') return false;
    
    // Set default values for enterprise capabilities
    switch (flag) {
      case 'enableTeams':
      case 'enableGoogle':
      case 'enableProctoring':
      case 'enableAI':
      case 'enableReports':
        return true;
      default:
        return false;
    }
  }
}
