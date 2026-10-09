import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import {
  QueryTeamWorkloadDTO,
  QueryTeamWorkloadIssuesDTO,
} from "../dto/query-team-workload.dto";
import { TeamWorkloadService } from "../services/team-workload.service";

@injectable()
export class TeamWorkloadController {
  constructor(private readonly teamWorkloadService: TeamWorkloadService) {}

  getOverview = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const query = (req as any).validatedQuery as QueryTeamWorkloadDTO;
      const actorId = (req as any).user.id;
      const data = await this.teamWorkloadService.getOverview(query, actorId);

      res.status(200).json({
        success: true,
        message: "Team Workload Overview berhasil diambil.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getAssignees = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const query = (req as any).validatedQuery as QueryTeamWorkloadDTO;
      const actorId = (req as any).user.id;
      const data = await this.teamWorkloadService.getAssignees(query, actorId);

      res.status(200).json({
        success: true,
        message: "Team Workload by Assignee berhasil diambil.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getIssues = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const query = (req as any).validatedQuery as QueryTeamWorkloadIssuesDTO;
      const actorId = (req as any).user.id;
      const data = await this.teamWorkloadService.getIssues(query, actorId);

      res.status(200).json({
        success: true,
        message: "Team Workload Issues berhasil diambil.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
