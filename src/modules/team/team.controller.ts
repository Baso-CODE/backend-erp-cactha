import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";

import { getStringParam } from "../../helpers/request.helper";
import { AddTeamMemberDTO } from "./dto/add-team-member.dto";
import { CreateTeamDTO } from "./dto/create-team.dto";
import { QueryTeamMemberOptionsDTO } from "./dto/query-team-member-options.dto";
import { QueryTeamDTO } from "./dto/query-team.dto";
import { UpdateTeamDTO } from "./dto/update-team.dto";
import { TeamService } from "./team.service";

@injectable()
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  getTeams = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.id;
      const query = (req as any).validatedQuery as QueryTeamDTO;

      const result = await this.teamService.getTeams(query, actorId);

      res.status(200).json({
        success: true,
        message: "Team berhasil diambil.",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getTeamById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.id;
      const id = getStringParam(req.params.id);

      const data = await this.teamService.getTeamById(id, actorId);

      res.status(200).json({
        success: true,
        message: "Detail team berhasil diambil.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  createTeam = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.id;
      const payload = req.body as CreateTeamDTO;

      const data = await this.teamService.createTeam(payload, actorId);

      res.status(201).json({
        success: true,
        message: "Team berhasil dibuat.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  updateTeam = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.id;
      const id = getStringParam(req.params.id);
      const payload = req.body as UpdateTeamDTO;

      const data = await this.teamService.updateTeam(id, payload, actorId);

      res.status(200).json({
        success: true,
        message: "Team berhasil diperbarui.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteTeam = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.id;
      const id = getStringParam(req.params.id);

      const result = await this.teamService.deleteTeam(id, actorId);

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  addMember = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.id;
      const teamId = getStringParam(req.params.id);
      const payload = req.body as AddTeamMemberDTO;

      const data = await this.teamService.addMember(teamId, payload, actorId);

      res.status(201).json({
        success: true,
        message: "Anggota berhasil ditambahkan ke team.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  removeMember = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.id;
      const teamId = getStringParam(req.params.id);
      const userId = getStringParam(req.params.userId);

      const result = await this.teamService.removeMember(
        teamId,
        userId,
        actorId,
      );

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getMemberOptions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.id;
      const teamId = getStringParam(req.params.id);

      const query = (req as any).validatedQuery as QueryTeamMemberOptionsDTO;

      const data = await this.teamService.getMemberOptions(
        teamId,
        query,
        actorId,
      );

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
