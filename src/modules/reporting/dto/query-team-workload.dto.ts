import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export enum WorkloadIssueType {
  ALL = "ALL",
  OVERDUE = "OVERDUE",
  BLOCKED = "BLOCKED",
  DUE_SOON = "DUE_SOON",
  HIGH_PRIORITY = "HIGH_PRIORITY",
}

export class QueryTeamWorkloadDTO {
  @IsOptional()
  @IsUUID("4")
  projectId?: string;

  @IsOptional()
  @IsUUID("4")
  assigneeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;
}

export class QueryTeamWorkloadIssuesDTO extends QueryTeamWorkloadDTO {
  @IsOptional()
  @IsEnum(WorkloadIssueType)
  issueType: WorkloadIssueType = WorkloadIssueType.ALL;
}
