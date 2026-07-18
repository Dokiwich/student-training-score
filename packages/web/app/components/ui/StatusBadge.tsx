import React from 'react';
import { Badge } from './Badge';
import { scoringSheetStatusConfig, appealStatusConfig, semesterStatusConfig } from '../../../lib/statusConfig';

interface StatusBadgeProps {
  status: string;
  className?: string;
  type?: 'scoring' | 'appeal' | 'semester';
}

export function StatusBadge({ status, className, type = 'scoring' }: StatusBadgeProps) {
  let config;
  
  if (type === 'appeal') {
    config = appealStatusConfig[status] || { label: status, tone: 'neutral' };
  } else if (type === 'semester') {
    config = semesterStatusConfig[status] || { label: status, tone: 'neutral' };
  } else {
    config = scoringSheetStatusConfig[status] || { label: status, tone: 'neutral' };
  }
  
  return (
    <Badge variant={config.tone as any} className={className}>
      {config.label}
    </Badge>
  );
}
