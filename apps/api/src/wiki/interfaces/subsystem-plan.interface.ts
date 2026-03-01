export interface GroupingPlan {
  repoSummary: string;
  subsystems: SubsystemGroup[];
}

export interface SubsystemGroup {
  groupId: string;
  name: string;
  description: string;
  assignedFiles: string[];
  confidence: number;
}
