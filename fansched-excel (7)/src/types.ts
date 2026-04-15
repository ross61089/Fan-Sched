export interface FanData {
  tag: string;
  type: string;
  manufacturer?: string;
  model?: string;
  cfm: number;
  esp: number;
  rpm?: number;
  hp?: string;
  driveType?: string;
  voltage?: string;
  phase?: number;
  notes?: string;
  metricCfm?: number; // L/S
  metricEsp?: number; // Pa
}

export interface FanGroup {
  name: string;
  cfm: number;
  esp: number;
  fans: FanData[];
}

export interface FanTypeTab {
  typeName: string;
  specNotes: string[];
  groups: FanGroup[];
}

export interface FanSchedule {
  tabs: FanTypeTab[];
}
