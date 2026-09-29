// proposal.controller.ts

import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";

import { plainToInstance } from "class-transformer";
import { validateOrReject } from "class-validator";
import { getStringParam } from "../../helpers/request.helper";
import { QueryProposalDTO } from "./dto/query-proposal.dto";
import { ProposalService } from "./proposal.service";

@injectable()
export class ProposalController {
  constructor(private readonly proposalService: ProposalService) {}

  getAllProposals = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;

      const query = plainToInstance(QueryProposalDTO, req.query);

      await validateOrReject(query);

      const result = await this.proposalService.getAllProposals(query, user.id);

      res.status(200).json({
        success: true,
        message: "Daftar proposal berhasil diambil.",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getProposalById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const id = getStringParam(req.params.id);

      const proposal = await this.proposalService.getProposalById(id, user.id);

      res.status(200).json({
        success: true,
        data: proposal,
      });
    } catch (error) {
      next(error);
    }
  };

  createProposal = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;

      const proposal = await this.proposalService.createProposal(
        req.body,
        user.id,
      );

      res.status(201).json({
        success: true,
        message: "Proposal berhasil dibuat.",
        data: proposal,
      });
    } catch (error) {
      next(error);
    }
  };

  updateProposal = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const id = getStringParam(req.params.id);

      const proposal = await this.proposalService.updateProposal(
        id,
        req.body,
        user.id,
      );

      res.status(200).json({
        success: true,
        message: "Proposal berhasil diperbarui.",
        data: proposal,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteProposal = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const id = getStringParam(req.params.id);

      const result = await this.proposalService.deleteProposal(id, user.id);

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };
}
