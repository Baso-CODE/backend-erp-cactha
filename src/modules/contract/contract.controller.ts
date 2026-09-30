import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";

import { getStringParam } from "../../helpers/request.helper";
import { ContractService } from "./contract.service";
import { CreateContractDTO } from "./dto/create-contract.dto";
import { QueryContractDTO } from "./dto/query-contract.dto";
import { UpdateContractDTO } from "./dto/update-contract.dto";

@injectable()
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  getAllContracts = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const query = (req as any).validatedQuery as QueryContractDTO;

      const result = await this.contractService.getAllContracts(query, user.id);

      res.status(200).json({
        success: true,
        message: "Daftar contract berhasil diambil.",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getContractById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;

      const contract = await this.contractService.getContractById(id, user.id);

      res.status(200).json({
        success: true,
        data: contract,
      });
    } catch (error) {
      next(error);
    }
  };

  createContract = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const data = req.body as CreateContractDTO;

      const contract = await this.contractService.createContract(data, user.id);

      res.status(201).json({
        success: true,
        message: "Contract berhasil dibuat.",
        data: contract,
      });
    } catch (error) {
      next(error);
    }
  };

  updateContract = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;
      const data = req.body as UpdateContractDTO;

      const contract = await this.contractService.updateContract(
        id,
        data,
        user.id,
      );

      res.status(200).json({
        success: true,
        message: "Contract berhasil diperbarui.",
        data: contract,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteContract = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;

      const result = await this.contractService.deleteContract(id, user.id);

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };
}
